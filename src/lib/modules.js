// The Module interface contract for MemoStack.
// Every module (projects, people, ideas, and future modules) must export
// a default object satisfying this shape.
//
// Adding a new module:
// 1. Create src/modules/<name>/index.js exporting a Module object
// 2. Register it in MODULE_REGISTRY below
// Done — routing, dashboard, tasks index, and sidebar pick it up automatically.

/**
 * @typedef {Object} MatchRule
 * @property {string} marker        - Annotation tag the AI produces e.g. "action", "decision"
 * @property {string} targetSection - Markdown heading to append under e.g. "## Open Actions"
 */

/**
 * @typedef {Object} DashboardSection
 * @property {string}   title      - Section heading shown on Command Center
 * @property {Function} component  - React component: ({ entries }) => JSX
 *                                   `entries` are IndexEntry objects for this module
 */

/**
 * @typedef {Object} Module
 * @property {string}            id               - Unique slug e.g. "projects"
 * @property {string}            label            - Display name e.g. "Projects"
 * @property {string}            vaultFolder      - Folder name in vault root e.g. "projects"
 * @property {string[]}          tags             - Tags this module contributes to tags.md
 * @property {Function}          templateFn       - () => string — blank entity file content
 * @property {MatchRule[]}       matchRules        - Routing rules for this module
 * @property {DashboardSection}  dashboardSection  - What this module contributes to Command Center
 * @property {Function}          listPage          - React component: () => JSX
 * @property {Function}          detailPage        - React component: ({ file }) => JSX
 * @property {Function}          createPage        - React component: () => JSX
 */

import projectsModule from '../modules/projects/index.jsx'
import peopleModule from '../modules/people/index.jsx'
import ideasModule from '../modules/ideas/index.jsx'

export const MODULE_REGISTRY = [
  projectsModule,
  peopleModule,
  ideasModule,
]

export function getModule(id) {
  return MODULE_REGISTRY.find(m => m.id === id)
}

export function getAllMatchRules() {
  return MODULE_REGISTRY.flatMap(m => m.matchRules)
}

export function getAllModuleTags() {
  return MODULE_REGISTRY.flatMap(m => m.tags)
}

export function getAllModuleFolders() {
  return MODULE_REGISTRY.map(m => m.vaultFolder)
}
