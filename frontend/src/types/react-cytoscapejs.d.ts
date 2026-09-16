declare module 'react-cytoscapejs' {
  import type { Core, ElementDefinition } from 'cytoscape'
  import type { CSSProperties, Component } from 'react'

  interface CytoscapeComponentProps {
    elements: ElementDefinition[]
    style?: CSSProperties
    stylesheet?: any
    layout?: any
    cy?: (cy: Core) => void
    [key: string]: any
  }

  export default class CytoscapeComponent extends Component<CytoscapeComponentProps> {}
}
