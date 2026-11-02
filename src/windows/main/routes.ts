// The pages of the main window (spec J3 § 4.1).
import { History, Keyboard, Settings, type LucideIcon } from 'lucide-react';
import type { MessageKey } from '@/i18n';

export type Route = 'history' | 'shortcuts' | 'settings' | 'about';

export const DEFAULT_ROUTE: Route = 'history';

export type NavItem = { route: Route; label: MessageKey; icon: LucideIcon };

/** The main navigation; « À propos » sits apart, at the bottom of the sidebar. */
export function navItems(): NavItem[] {
  return [
    { route: 'history', label: 'main.history', icon: History },
    { route: 'shortcuts', label: 'main.shortcuts', icon: Keyboard },
    { route: 'settings', label: 'main.settings', icon: Settings },
  ];
}
