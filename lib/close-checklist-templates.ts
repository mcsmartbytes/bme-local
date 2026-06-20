export type ChecklistItem = { label: string; checked: boolean };

const CHECKLIST_TEMPLATES: Record<string, ChecklistItem[]> = {
  construction: [
    { label: 'Bank accounts reconciled', checked: false },
    { label: 'WIP schedule updated', checked: false },
    { label: 'Revenue recognized per % complete', checked: false },
    { label: 'Financial statements reviewed', checked: false },
  ],
  restaurant: [
    { label: 'Bank accounts reconciled', checked: false },
    { label: 'POS sales reconciled to deposits', checked: false },
    { label: 'Food & beverage inventory counted', checked: false },
    { label: 'Financial statements reviewed', checked: false },
  ],
  general: [
    { label: 'Bank accounts reconciled', checked: false },
    { label: 'Accounts receivable reviewed', checked: false },
    { label: 'Accounts payable current', checked: false },
    { label: 'Payroll posted and verified', checked: false },
    { label: 'Financial statements reviewed', checked: false },
  ],
};

export function getChecklistTemplate(industryId: string): ChecklistItem[] {
  return CHECKLIST_TEMPLATES[industryId] ?? CHECKLIST_TEMPLATES.general;
}