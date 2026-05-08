"""
Script to ensure only one CompanyProfile exists in Neo4j.
Run this script to clean up duplicate company profiles.
"""
from database import driver

def cleanup_company_profiles():
    """Ensure only one CompanyProfile exists in Neo4j."""
    try:
        with driver.session() as session:
            # Get all company profiles
            result = session.run("MATCH (c:CompanyProfile) RETURN c, id(c) as node_id ORDER BY id(c)")
            records = list(result)
            
            if len(records) == 0:
                print("No company profiles found in Neo4j.")
                return {"deleted": 0, "remaining": 0}
            
            if len(records) == 1:
                print("✓ Only one company profile exists. No cleanup needed.")
                return {"deleted": 0, "remaining": 1}
            
            print(f"Found {len(records)} company profiles. Cleaning up...")
            
            # Keep the first one (oldest by node ID)
            first_node_id = records[0]["node_id"]
            first_profile = dict(records[0]["c"])
            print(f"Keeping profile with ID {first_node_id}")
            
            # Delete all others
            delete_result = session.run(
                "MATCH (c:CompanyProfile) WHERE id(c) <> $keep_id DELETE c RETURN count(c) as deleted",
                keep_id=first_node_id
            )
            deleted_count = delete_result.single()["deleted"]
            
            print(f"✓ Cleanup completed. Kept 1 profile, deleted {deleted_count} duplicate(s).")
            return {
                "deleted": deleted_count,
                "remaining": 1
            }
    
    except Exception as e:
        print(f"Error during cleanup: {e}")
        raise

if __name__ == "__main__":
    print("Starting company profile cleanup...")
    result = cleanup_company_profiles()
    print(f"Result: {result}")

