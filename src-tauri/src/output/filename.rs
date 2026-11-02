//! File names from the name template (spec § 7.3).
use std::path::{Path, PathBuf};

use chrono::NaiveDateTime;

const FORBIDDEN: &[char] = &['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
const RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];
const MAX_TITLE_CHARS: usize = 60;
const MAX_NAME_CHARS: usize = 150;

pub struct NameContext {
    pub taken_at: NaiveDateTime,
    pub window_title: Option<String>,
    pub counter: u32,
}

/// Replaces the tokens in one pass (so a window title is never read as a template), then
/// sanitizes the result. Unknown tokens stay as written.
pub fn render_name(template: &str, ctx: &NameContext) -> String {
    let mut out = String::new();
    let mut rest = template;
    while let Some(open) = rest.find('{') {
        out.push_str(&rest[..open]);
        let after = &rest[open..];
        let Some(close) = after.find('}') else {
            out.push_str(after);
            rest = "";
            break;
        };
        let token = &after[1..close];
        match token_value(token, ctx) {
            Some(value) => out.push_str(&value),
            None => out.push_str(&after[..=close]),
        }
        rest = &after[close + 1..];
    }
    out.push_str(rest);
    let name = sanitize(&out);
    if name.is_empty() {
        "Kirishot".into()
    } else {
        name
    }
}

fn token_value(token: &str, ctx: &NameContext) -> Option<String> {
    Some(match token {
        "date" => ctx.taken_at.format("%Y-%m-%d").to_string(),
        // Colons are forbidden in Windows file names.
        "heure" | "time" => ctx.taken_at.format("%H.%M.%S").to_string(),
        "fenêtre" | "window" => ctx
            .window_title
            .as_deref()
            .unwrap_or("")
            .chars()
            .take(MAX_TITLE_CHARS)
            .collect(),
        "n" => ctx.counter.to_string(),
        _ => return None,
    })
}

/// Makes `name` a valid Windows file name (without extension).
pub fn sanitize(name: &str) -> String {
    let replaced: String = name
        .chars()
        .map(|c| {
            if FORBIDDEN.contains(&c) || c.is_control() {
                '-'
            } else {
                c
            }
        })
        .collect();
    let collapsed = replaced.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut name = trim_end(&collapsed).to_string();
    let stem = name.split('.').next().unwrap_or("");
    if RESERVED.iter().any(|r| r.eq_ignore_ascii_case(stem)) {
        name.insert(0, '_');
    }
    let truncated: String = name.chars().take(MAX_NAME_CHARS).collect();
    trim_end(&truncated).to_string()
}

fn trim_end(s: &str) -> &str {
    s.trim_end_matches(['.', ' '])
}

/// `dir/stem.ext`, or `dir/stem (2).ext`, `dir/stem (3).ext`… when it already exists.
pub fn unique_path(dir: &Path, stem: &str, ext: &str, exists: impl Fn(&Path) -> bool) -> PathBuf {
    let first = dir.join(format!("{stem}.{ext}"));
    if !exists(&first) {
        return first;
    }
    (2..)
        .map(|n| dir.join(format!("{stem} ({n}).{ext}")))
        .find(|p| !exists(p))
        .expect("an unused name always exists")
}

/// Why a name typed in the editor is refused (spec J3 § 3.3).
#[derive(Debug, PartialEq, Eq)]
pub enum StemError {
    Empty,
    ForbiddenChar(char),
    Reserved,
}

pub fn validate_stem(stem: &str) -> Result<(), StemError> {
    if stem.trim().is_empty() {
        return Err(StemError::Empty);
    }
    if let Some(c) = stem.chars().find(|c| {
        matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control()
    }) {
        return Err(StemError::ForbiddenChar(c));
    }
    if RESERVED.iter().any(|r| r.eq_ignore_ascii_case(stem.trim())) {
        return Err(StemError::Reserved);
    }
    Ok(())
}

#[derive(Debug, PartialEq, Eq)]
pub enum RenameError {
    Invalid(StemError),
    Taken,
}

/// The new path of `current` renamed to `new_stem` (same folder and extension); `None` when the
/// name does not change.
pub fn rename_plan(
    current: &Path,
    new_stem: &str,
    exists: impl Fn(&Path) -> bool,
) -> Result<Option<PathBuf>, RenameError> {
    validate_stem(new_stem).map_err(RenameError::Invalid)?;
    let old_stem = current
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    if old_stem == new_stem {
        return Ok(None);
    }
    let ext = current
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let next = current.with_file_name(format!("{new_stem}{ext}"));
    // A change of case only: Windows sees the same file, which is not a conflict.
    let same_file = old_stem.to_lowercase() == new_stem.to_lowercase();
    if !same_file && exists(&next) {
        return Err(RenameError::Taken);
    }
    Ok(Some(next))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_stem_refuses_what_windows_refuses() {
        assert_eq!(validate_stem(""), Err(StemError::Empty));
        assert_eq!(validate_stem("   "), Err(StemError::Empty));
        assert_eq!(validate_stem("a:b"), Err(StemError::ForbiddenChar(':')));
        assert_eq!(validate_stem("a?"), Err(StemError::ForbiddenChar('?')));
        assert_eq!(validate_stem("CON"), Err(StemError::Reserved));
        assert_eq!(validate_stem("nul"), Err(StemError::Reserved));
        assert_eq!(validate_stem("com1"), Err(StemError::Reserved));
        assert_eq!(validate_stem("Rapport final"), Ok(()));
    }

    #[test]
    fn rename_plan_handles_same_name_case_and_conflicts() {
        let current = Path::new(r"C:\x\Rapport.png");
        let everything_exists = |_: &Path| true;
        assert_eq!(rename_plan(current, "Rapport", everything_exists), Ok(None));
        assert_eq!(
            rename_plan(current, "rapport", everything_exists),
            Ok(Some(PathBuf::from(r"C:\x\rapport.png")))
        );
        assert_eq!(
            rename_plan(current, "Autre", everything_exists),
            Err(RenameError::Taken)
        );
        assert_eq!(
            rename_plan(current, "Autre", |_: &Path| false),
            Ok(Some(PathBuf::from(r"C:\x\Autre.png")))
        );
        assert_eq!(
            rename_plan(current, "a/b", |_: &Path| false),
            Err(RenameError::Invalid(StemError::ForbiddenChar('/')))
        );
    }
    use chrono::NaiveDate;
    use std::path::Path;

    fn ctx(title: Option<&str>) -> NameContext {
        NameContext {
            taken_at: NaiveDate::from_ymd_opt(2026, 11, 1)
                .unwrap()
                .and_hms_opt(14, 32, 5)
                .unwrap(),
            window_title: title.map(Into::into),
            counter: 42,
        }
    }

    #[test]
    fn french_default_template() {
        assert_eq!(
            render_name("Kirishot {date} à {heure}", &ctx(None)),
            "Kirishot 2026-11-01 à 14.32.05"
        );
    }

    #[test]
    fn english_tokens() {
        assert_eq!(
            render_name("Kirishot {date} at {time}", &ctx(None)),
            "Kirishot 2026-11-01 at 14.32.05"
        );
    }

    #[test]
    fn window_token_both_languages() {
        assert_eq!(
            render_name("{fenêtre} {date}", &ctx(Some("Paramètres du compte"))),
            "Paramètres du compte 2026-11-01"
        );
        assert_eq!(render_name("{window} {date}", &ctx(None)), "2026-11-01");
    }

    #[test]
    fn window_title_is_cut_to_60_chars() {
        assert_eq!(
            render_name("{window}", &ctx(Some(&"é".repeat(80)))),
            "é".repeat(60)
        );
    }

    #[test]
    fn window_title_is_never_read_as_a_template() {
        assert_eq!(
            render_name("{window}", &ctx(Some("Notes {n} {date}"))),
            "Notes {n} {date}"
        );
    }

    #[test]
    fn counter_token() {
        assert_eq!(render_name("Shot {n}", &ctx(None)), "Shot 42");
    }

    #[test]
    fn unknown_tokens_stay_literal() {
        assert_eq!(render_name("A {foo}", &ctx(None)), "A {foo}");
    }

    #[test]
    fn empty_result_falls_back_to_kirishot() {
        assert_eq!(render_name("{fenêtre}", &ctx(None)), "Kirishot");
    }

    #[test]
    fn sanitize_replaces_forbidden_chars() {
        assert_eq!(
            sanitize("a<b>c:d\"e/f\\g|h?i*j\tk"),
            "a-b-c-d-e-f-g-h-i-j-k"
        );
    }

    #[test]
    fn sanitize_collapses_and_trims() {
        assert_eq!(sanitize("  rapport   final .. "), "rapport final");
    }

    #[test]
    fn sanitize_prefixes_reserved_names() {
        assert_eq!(sanitize("CON"), "_CON");
        assert_eq!(sanitize("com1"), "_com1");
        assert_eq!(sanitize("console"), "console");
    }

    #[test]
    fn sanitize_truncates_to_150_chars() {
        assert_eq!(sanitize(&"a".repeat(200)).chars().count(), 150);
    }

    #[test]
    fn unique_path_adds_counter_suffix() {
        let dir = Path::new(r"C:\x");
        let taken = [dir.join("Shot.png"), dir.join("Shot (2).png")];
        assert_eq!(
            unique_path(dir, "Shot", "png", |p| taken.contains(&p.to_path_buf())),
            dir.join("Shot (3).png")
        );
        assert_eq!(
            unique_path(dir, "Libre", "png", |_| false),
            dir.join("Libre.png")
        );
    }
}
