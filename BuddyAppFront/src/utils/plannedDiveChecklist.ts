export type ChecklistItem = {
  id: string;
  label: string;
  group: string;
};

export const CHECKLIST: ChecklistItem[] = [
  { id: 'mask', label: 'Mask and spare mask', group: 'Personal gear' },
  { id: 'fins', label: 'Fins and boots', group: 'Personal gear' },
  { id: 'computer', label: 'Dive computer charged', group: 'Personal gear' },
  { id: 'buoyancy', label: 'BCD inflator tested', group: 'Personal gear' },
  { id: 'regulator', label: 'Regulator and alternate air source', group: 'Gas and equipment' },
  { id: 'tank', label: 'Tank visual inspection complete', group: 'Gas and equipment' },
  { id: 'weights', label: 'Weights and quick-release checked', group: 'Gas and equipment' },
  { id: 'surface', label: 'Surface marker and whistle packed', group: 'Safety' },
  { id: 'first-aid', label: 'First aid kit and emergency contacts', group: 'Safety' },
];

// Older plans only stored items the diver had toggled. Missing items are not ready.
export const completeChecklist = (values?: Record<string, boolean> | null) => ({
  ...Object.fromEntries(CHECKLIST.map(item => [item.id, false])),
  ...values,
});
