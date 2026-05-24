import React from 'react'
import ModuleListPage from '../../components/ModuleListPage'

const IdeasModule = {
  id: 'ideas',
  label: 'Ideas',
  singularLabel: 'Idea',
  vaultFolder: 'ideas',
  tags: [
    'idea', 'spark', 'exploring', 'validating', 'building', 'parked', 'killed',
    'idea_AI', 'idea_process', 'idea_design', 'idea_project', 'idea_ops', 'idea_personal',
  ],
  templateFn: () => `---
type: idea
domain:
status: Spark
origin: ${new Date().toISOString().split('T')[0]}
related_projects: []
related_people: []
tags: []
last_updated: ${new Date().toISOString().split('T')[0]}
---
## Summary
## Problem It Solves
## Next Step
## Notes
`,
  matchRules: [
    { marker: 'idea',    targetSection: '## Notes' },
    { marker: 'mention', targetSection: '## Notes' },
  ],
  dashboardSection: {
    title: 'Ideas',
    component: ({ entries }) => (
      <div className="text-sm text-gray-400">Ideas — coming soon</div>
    ),
  },
  listPage:   (props) => <ModuleListPage {...props} label="Ideas" vaultFolder="ideas" />,
  detailPage: (props) => <ModuleListPage {...props} label="Ideas" vaultFolder="ideas" />,
  createPage: () => <div className="p-8 text-gray-400">New idea — coming soon</div>,
}

export default IdeasModule
