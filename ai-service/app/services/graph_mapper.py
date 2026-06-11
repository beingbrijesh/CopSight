"""
Graph Mapper for Identity Resolution and Event Tracking
"""
from typing import List, Dict, Any
from loguru import logger
from app.services.database import db_manager

class GraphMapper:
    """Handles Identity Resolution and Graph visual state updates"""

    async def ingest_entities_and_relationships(self, case_id: int, parsed_data: Dict[str, Any]):
        """
        Parses extracted data, resolves identities, and loads nodes/edges into Neo4j.
        Increments event_counts and updates visual flags.
        """
        if not db_manager.neo4j:
            logger.warning("Neo4j not connected, skipping graph mapping.")
            return

        entities = parsed_data.get("entities", [])
        relationships = parsed_data.get("relationships", [])
        
        # Identity Resolution: Separate concrete identifiers from general Person names
        phones = [e for e in entities if e["type"] == "PhoneNumber"]
        aadhars = [e for e in entities if e["type"] == "Aadhaar"]
        banks = [e for e in entities if e["type"] == "BankAccount"]
        persons = [e for e in entities if e["type"] == "Person"]
        
        async with db_manager.neo4j.session() as session:
            # 1. Create Identity Anchors (Phones, Aadhars, Banks)
            for phone in phones:
                await session.run("""
                    MERGE (p:PhoneNumber {number: $val})
                    ON CREATE SET p.case_ids = [$case_id], p.event_count = 1, p.is_flagged = false
                    ON MATCH SET p.case_ids = CASE WHEN p.case_ids IS NULL THEN [$case_id] WHEN NOT $case_id IN p.case_ids THEN p.case_ids + [$case_id] ELSE p.case_ids END, p.event_count = coalesce(p.event_count, 0) + 1
                """, val=phone["value"], case_id=case_id)
                
            for aadhaar in aadhars:
                await session.run("""
                    MERGE (a:Aadhaar {id: $val})
                    ON CREATE SET a.case_ids = [$case_id], a.event_count = 1, a.is_flagged = false
                    ON MATCH SET a.case_ids = CASE WHEN a.case_ids IS NULL THEN [$case_id] WHEN NOT $case_id IN a.case_ids THEN a.case_ids + [$case_id] ELSE a.case_ids END, a.event_count = coalesce(a.event_count, 0) + 1
                """, val=aadhaar["value"], case_id=case_id)

            for bank in banks:
                await session.run("""
                    MERGE (b:BankAccount {account_number: $val})
                    ON CREATE SET b.case_ids = [$case_id], b.event_count = 1, b.is_flagged = false
                    ON MATCH SET b.case_ids = CASE WHEN b.case_ids IS NULL THEN [$case_id] WHEN NOT $case_id IN b.case_ids THEN b.case_ids + [$case_id] ELSE b.case_ids END, b.event_count = coalesce(b.event_count, 0) + 1
                """, val=bank["value"], case_id=case_id)

            # 2. Merge Persons to Identifiers (Identity Resolution)
            for person in persons:
                # If we have relationships tying this person to an identifier, we merge them into a single Person node
                # tied specifically to that identifier rather than just creating a loose name node.
                # Find relationships where this person is the source
                person_rels = [r for r in relationships if r["source"] == person["value"]]
                
                identifiers = []
                for rel in person_rels:
                    if rel["target_type"] in ["PhoneNumber", "Aadhaar", "BankAccount"]:
                        identifiers.append(rel["target"])
                
                # If person has an identifier, we use that as primary key for the person node
                if identifiers:
                    primary_id = identifiers[0]  # Simplistic resolution for now
                    await session.run("""
                        MERGE (p:Person {primary_id: $primary_id})
                        ON CREATE SET p.name = $name, p.case_ids = [$case_id], p.event_count = 1, p.is_flagged = false
                        ON MATCH SET p.case_ids = CASE WHEN p.case_ids IS NULL THEN [$case_id] WHEN NOT $case_id IN p.case_ids THEN p.case_ids + [$case_id] ELSE p.case_ids END, p.event_count = coalesce(p.event_count, 0) + 1
                    """, primary_id=primary_id, name=person["value"], case_id=case_id)
                else:
                    # Loose person node (High risk of duplication, but necessary if no identifiers exist)
                    await session.run("""
                        MERGE (p:Person {name: $name})
                        ON CREATE SET p.case_ids = [$case_id], p.event_count = 1, p.is_flagged = false
                        ON MATCH SET p.case_ids = CASE WHEN p.case_ids IS NULL THEN [$case_id] WHEN NOT $case_id IN p.case_ids THEN p.case_ids + [$case_id] ELSE p.case_ids END, p.event_count = coalesce(p.event_count, 0) + 1
                    """, name=person["value"], case_id=case_id)
            
            # 3. Create Events and check Flagging
            for rel in relationships:
                # E.g., Person -[TRANSACTED_WITH]-> BankAccount
                await session.run(f"""
                    MATCH (s), (t)
                    WHERE (s.primary_id = $src OR s.name = $src OR s.number = $src OR s.account_number = $src OR s.id = $src)
                      AND (t.primary_id = $tgt OR t.name = $tgt OR t.number = $tgt OR t.account_number = $tgt OR t.id = $tgt)
                    MERGE (s)-[r:{rel["type"]}]->(t)
                    ON CREATE SET r.timestamp = $ts, r.case_id = $case_id
                """, src=rel["source"], tgt=rel["target"], ts=rel.get("timestamp", ""), case_id=case_id)
                
            # 4. Update is_flagged visually for nodes with high event count or crime links
            await session.run("""
                MATCH (n)
                WHERE n.event_count > 10 OR n:Suspect
                SET n.is_flagged = true
            """)
            
            # 5. Link all extracted entities to the central Case node to restore graph visibility
            # The frontend traversal specifically looks for paths radiating from the Case node.
            await session.run("""
                MATCH (n)
                WHERE $case_id IN n.case_ids AND NOT n:Case
                MERGE (c:Case {id: $case_id})
                MERGE (c)-[:HAS_ENTITY]->(n)
            """, case_id=case_id)
        
        logger.info(f"Graph mapping completed for case {case_id}")

graph_mapper = GraphMapper()
