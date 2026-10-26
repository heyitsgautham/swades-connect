// Tailwind class lists shared by the popup's inputs and buttons.

/** Text and number inputs in the tab filter rows. */
export const fieldClassName = 'flex-1 border border-border px-2 py-1.5 text-[12px] outline-none';

/** Selects in the tab filter rows. */
export const selectClassName = `${fieldClassName} cursor-pointer`;

/** The red gradient buttons, Extract Now and Delete All. They grow on hover and shrink while pressed. */
export function primaryButtonClassName(disabled: boolean): string {
  const state = disabled
    ? 'cursor-not-allowed bg-[#6b7280]'
    : 'cursor-pointer bg-[linear-gradient(to_right,#8B2E2E,#A03535)] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:scale-[1.02] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] active:scale-95';
  return `flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white [transition:all_0.2s_ease] ${state}`;
}

/** The round trash buttons on table rows and activity cards. */
export const deleteIconButtonClassName =
  'flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent p-1.5 text-[#9ca3af] [transition:all_0.2s_ease] hover:bg-[#fef2f2] hover:text-[#dc2626]';
