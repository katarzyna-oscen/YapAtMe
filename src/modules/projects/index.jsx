import React from 'react'
import ModuleListPage from '../../components/ModuleListPage'

const ProjectsModule = {
  id: 'projects',
  label: 'Projects',
  singularLabel: 'Project',
  vaultFolder: 'projects',
  tags: [
    'project', 'blocked', 'in-progress', 'in-review',
    'to-be-deployed', 'done', 'action', 'decision',
  ],
  templateFn: () => `---
type: project
domain: []
core_problem:
owner:
status: Untriaged
last_updated: ${new Date().toISOString().split('T')[0]}
---
## Status
## Open Actions
## Delegations
## Decisions
## Recent Mentions
## Notes
`,
  matchRules: [
    { marker: 'action',    targetSection: '## Open Actions' },
    { marker: 'decision',  targetSection: '## Decisions' },
    { marker: 'delegate',  targetSection: '## Delegations' },
    { marker: 'mention',   targetSection: '## Recent Mentions' },
  ],
  dashboardSection: {
    title: 'Projects',
    component: ({ entries }) => (
      <div className="text-sm text-gray-400">Projects — coming soon</div>
    ),
  },
  listPage:   (props) => <ModuleListPage {...props} label="Projects" vaultFolder="projects" />,
  detailPage: (props) => <ModuleListPage {...props} label="Projects" vaultFolder="projects" />,
  createPage: () => <div className="p-8 text-gray-400">New project — coming soon</div>,
}

export default ProjectsModule
