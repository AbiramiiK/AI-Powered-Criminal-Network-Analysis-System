export interface Person {
  person_id: string
  full_name: string
  primary_alias?: string
  alternate_alias?: string
  phone_id_primary?: string
  phone_id_secondary?: string
  address_zone?: string
  organization?: string
  entity_type?: string
}

export interface CaseRecord {
  case_id: string
  case_title: string
  crime_category: string
  opening_date: string
  region: string
  priority_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: string
  primary_persons_of_interest?: string
  description?: string
  poi_list?: string[]
  alert_count?: number
  event_count?: number
}

export interface Alert {
  alert_id: string
  alert_timestamp: string
  case_id: string
  alert_type: string
  person_id: string
  related_person_id?: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  explanation: string
  supporting_sources: string
  confidence_score: string
  analyst_status: 'NEW' | 'UNDER_REVIEW' | 'CONFIRMED_PATTERN' | 'DISMISSED'
  person_name?: string
  related_person_name?: string
}

export interface GraphNode {
  id: string
  type: 'PERSON' | 'PHONE' | 'VEHICLE' | 'LOCATION' | 'ORGANIZATION' | 'CASE'
  label: string
  degree: number
  is_center?: boolean
  analytical_tags?: string[]
  community_id?: number | null
  [key: string]: any
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relation: string
  relations?: string[]
  count: number
  label: string
  strength?: 'strong' | 'moderate' | 'weak'
  [key: string]: any
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface NetworkMetrics {
  node_count: number
  relationship_count: number
  communities: number
  key_connectors: number
  average_degree: number
  network_density: number
  modularity: number | null
}

export interface CommunitySummary {
  community_id: number
  size: number
  relationship_count: number
  activity_level: 'Low' | 'Medium' | 'High'
  key_connectors?: { person_id: string; name: string }[]
  key_connector_names?: string[]
  member_names?: string[]
  members?: string[]
}
