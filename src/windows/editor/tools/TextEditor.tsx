import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Annotation } from '@/editor/document';
import type { View } from '../viewport';
import { textKey } from './text';

type TextAnnotation = Extract<Annotation, { tool: 'text' }>;

type Props = {
  a: TextAnnotation;
  view: View;
  /** Called once, with the final text (empty: the annotation is dropped). */
  onDone(text: string): void;
};

/** In-place text editing: a textarea over the stage, same font and size (modelled on XenSnip). */
export function TextEditor({ a, view, onDone }: Props) {
  const [text, setText] = useState(a.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const finish = (value: string) => {
    if (done.current) return;
    done.current = true;
    onDone(value);
  };

  // After the frame that shows it: nothing left of the click can take the focus back.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Grows with its content.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
    el.style.width = '0px';
    el.style.width = `${Math.max(el.scrollWidth + 4, 40)}px`;
  }, [text]);

  const size = a.size * view.scale;
  return (
    <textarea
      ref={ref}
      value={text}
      aria-label="Texte"
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => finish(text)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (textKey(e.key, e.ctrlKey) === 'commit') {
          e.preventDefault();
          finish(text);
        }
      }}
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
      style={{
        left: view.x + a.at.x * view.scale,
        top: view.y + a.at.y * view.scale,
        font: `600 ${size}px/1 'Geist Variable', sans-serif`,
        color: a.style === 'pill' ? 'white' : a.color,
        background: a.style === 'pill' ? a.color : 'transparent',
        whiteSpace: 'pre',
        caretColor: a.style === 'pill' ? 'white' : a.color,
        outline: '1px dashed rgba(255,255,255,0.6)',
      }}
    />
  );
}
