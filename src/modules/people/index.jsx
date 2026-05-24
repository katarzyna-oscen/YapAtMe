import React from 'react'
import ModuleListPage from '../../components/ModuleListPage'

const PeopleModule = {
  id: 'people',
  label: 'People',
  singularLabel: 'Person',
  vaultFolder: 'people',
  tags: ['follow-up', 'waiting', 'delegate'],
  templateFn: () => `---
type: person
full_name:
relationship:
role:
last_updated: ${new Date().toISOString().split('T')[0]}
---

## Summary
_Who is this person and why do they matter to you?_

## Related Projects
_Link projects this person is involved in._


## Delegate
_Tasks you've delegated to this person. AI will add from your inbox._


## Talk About
_Topics to raise next time you speak. AI will add from your inbox._


## Recent Mentions
_Populated by AI._


## Notes
_Observations, context, anything worth remembering about this person._
`,
  matchRules: [
    { marker: 'delegate',   targetSection: '## Delegate' },
    { marker: 'follow-up',  targetSection: '## Talk About' },
    { marker: 'mention',    targetSection: '## Recent Mentions' },
  ],
  dashboardSection: {
    title: 'People',
    component: ({ entries }) => (
      <div className="text-sm text-gray-400">People — coming soon</div>
    ),
  },
  listPage:   (props) => <ModuleListPage {...props} label="People" vaultFolder="people" />,
  detailPage: (props) => <ModuleListPage {...props} label="People" vaultFolder="people" />,
  createPage: () => <div className="p-8 text-gray-400">New person — coming soon</div>,
}

export default PeopleModule
