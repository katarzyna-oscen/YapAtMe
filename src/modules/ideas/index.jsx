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
  templateFn: () => {
    const today = new Date().toISOString().split('T')[0]
    return `---\ntype: idea\nname: \ndomain: \nstatus: Spark\norigin: ${today}\nrelated_projects: []\nrelated_people: []\ntags: []\nlast_updated: ${today}\n---\n\n## Summary\n_One sentence describing this idea and why it matters._\n\n## Origin\n_Why did this idea come up?_\n\n## Developing\n\n\n## Outcome\n\n\n## Current Plan\n\n\n## Recent Mentions\n`
  },
  matchRules: [
    { marker: 'idea',    targetSection: '## Developing' },
    { marker: 'mention', targetSection: '## Recent Mentions' },
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
