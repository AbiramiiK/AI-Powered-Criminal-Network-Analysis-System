from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"

DATASET_FILES = {
    "persons": "persons.csv",
    "cdr": "cdr_records.csv",
    "locations": "location_records.csv",
    "transactions": "transactions.csv",
    "vehicles": "vehicles.csv",
    "vehicle_associations": "vehicle_associations.csv",
    "intelligence": "intelligence_reports.csv",
    "aliases": "entity_aliases.csv",
    "organizations": "organizations.csv",
    "person_org_links": "person_organization_links.csv",
    "evidence": "evidence_records.csv",
    "events": "investigation_events.csv",
    "cases": "cases.csv",
    "alerts": "alerts.csv",
    "fir": "synthetic_fir_reports.csv",
}

REQUIRED_COLUMNS = {
    "persons": ["person_id", "full_name", "primary_alias", "alternate_alias", "phone_id_primary",
                "phone_id_secondary", "address_zone", "organization", "entity_type", "data_source", "synthetic_data"],
    "cdr": ["call_id", "caller_id", "receiver_id", "timestamp", "duration_seconds",
            "communication_type", "cell_location", "data_source", "synthetic_data"],
    "locations": ["record_id", "person_id", "location_id", "location_name", "latitude", "longitude",
                  "timestamp", "observation_type", "data_source", "synthetic_data"],
    "transactions": ["transaction_id", "sender_id", "receiver_id", "amount", "currency", "timestamp",
                      "transaction_type", "pattern_label", "data_source", "synthetic_data"],
    "vehicles": ["vehicle_id", "registration_id", "primary_owner_id", "vehicle_type", "model_label",
                 "color_description", "data_source", "synthetic_data"],
    "vehicle_associations": ["association_id", "vehicle_id", "person_id", "relationship_type", "synthetic_data"],
    "intelligence": ["intelligence_id", "report_date", "source_type", "reliability_level", "region",
                      "subject_person_id", "related_person_ids", "related_location_id", "related_vehicle_id",
                      "information_text", "intelligence_category", "priority_level", "verification_status",
                      "data_source", "synthetic_data"],
    "aliases": ["alias_id", "person_id", "alias", "alias_type", "source_reference", "confidence_score", "synthetic_data"],
    "organizations": ["organization_id", "organization_name", "organization_type", "region", "description", "synthetic_data"],
    "person_org_links": ["link_id", "person_id", "organization_id", "relationship_type", "start_date", "end_date",
                          "confidence_score", "source_reference", "synthetic_data"],
    "evidence": ["evidence_id", "evidence_type", "source_reference", "person_id", "related_person_id",
                 "related_vehicle_id", "related_location_id", "related_fir_id", "collection_date", "description",
                 "evidence_status", "confidence_score", "synthetic_data"],
    "events": ["event_id", "case_id", "event_timestamp", "event_type", "person_id", "related_person_id",
               "location_id", "vehicle_id", "source_reference", "event_description", "confidence_score", "synthetic_data"],
    "cases": ["case_id", "case_title", "crime_category", "opening_date", "region", "priority_level", "status",
              "primary_persons_of_interest", "description", "synthetic_data"],
    "alerts": ["alert_id", "alert_timestamp", "case_id", "alert_type", "person_id", "related_person_id",
               "severity", "explanation", "supporting_sources", "confidence_score", "analyst_status", "synthetic_data"],
    "fir": ["fir_id", "report_date", "region", "location", "crime_category", "description", "persons_mentioned",
            "entity_ids", "evidence_source", "investigation_status", "synthetic_data"],
}

DEMO_MODE = True
