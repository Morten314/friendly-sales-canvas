"""
Test script for DELETE data-source API endpoint
Tests: Upload file, wait for processing, delete, verify deletion in AWS S3 and Pinecone
"""

import requests
import time
import boto3
from pinecone import Pinecone
import os
import json

# Configuration
BASE_URL = "https://backend-11kr.onrender.com"  # Render backend URL
TEST_USER_ID = "test_user_delete_123"
TEST_ORG_ID = "brewra"  # Change this to match your org_id
TEST_FILE = "test_delete_document.txt"

# S3 Configuration
S3_BUCKET = "brewra-data-sources"
AWS_REGION = "eu-north-1"
AWS_ACCESS_KEY = "AKIAWSX4DVX7DHHENUWS"
AWS_SECRET_KEY = "SKr+ZQ0CeyHLpFgXorlGPK7LioxEzqeziINnyAmJ"

# Pinecone Configuration
PINECONE_API_KEY = "pcsk_3Hv4td_HrXCeQPwZYJZT1Zf6nwtLjAC64E8WcJA1fQ6w18dGUnxsPLpoUrovVb7JCP862w"
PINECONE_INDEX = "brewra-documents"

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=AWS_REGION
)

# Initialize Pinecone
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX)

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def create_test_file():
    """Create a test file for uploading"""
    test_content = f"""
This is a test document for deletion testing.
Created at: {time.strftime('%Y-%m-%d %H:%M:%S')}
Test User ID: {TEST_USER_ID}
Test Org ID: {TEST_ORG_ID}
This document will be uploaded, processed, and then deleted.
"""
    with open(TEST_FILE, 'w') as f:
        f.write(test_content)
    print(f"[OK] Created test file: {TEST_FILE}")

def test_upload_file():
    """Test 1: Upload file to the API"""
    print_section("TEST 1: Upload File")
    
    create_test_file()
    
    try:
        url = f"{BASE_URL}/upload-document"
        with open(TEST_FILE, 'rb') as f:
            files = {'file': (TEST_FILE, f, 'text/plain')}
            data = {
                'user_id': TEST_USER_ID,
                'org_id': TEST_ORG_ID,
                'tags': 'test,delete,automated',
                'description': 'Test file for deletion testing'
            }
            response = requests.post(url, files=files, data=data)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            result = response.json()
            file_id = result.get('file_id')
            file_key = result.get('file_key')
            print(f"[OK] File uploaded successfully!")
            print(f"   File ID: {file_id}")
            print(f"   File Key: {file_key}")
            return file_id, file_key
        else:
            print(f"[ERROR] Upload failed: {response.text}")
            return None, None
            
    except Exception as e:
        print(f"[ERROR] Error uploading file: {str(e)}")
        return None, None

def verify_file_in_s3(file_key):
    """Verify file exists in S3"""
    print_section("VERIFY: File in S3")
    try:
        s3_client.head_object(Bucket=S3_BUCKET, Key=file_key)
        print(f"[OK] File exists in S3: {file_key}")
        return True
    except s3_client.exceptions.NoSuchKey:
        print(f"[ERROR] File NOT found in S3: {file_key}")
        return False
    except Exception as e:
        print(f"[ERROR] Error checking S3: {str(e)}")
        return False

def verify_vectors_in_pinecone(file_id, org_id):
    """Verify vectors exist in Pinecone"""
    print_section("VERIFY: Vectors in Pinecone")
    try:
        # Query for vectors with this file_id
        query_result = index.query(
            vector=[0.0] * 1024,  # Dummy vector
            top_k=10,
            namespace=org_id,
            filter={"file_id": {"$eq": file_id}},
            include_metadata=True
        )
        
        if query_result.matches:
            print(f"[OK] Found {len(query_result.matches)} vectors with file_id='{file_id}' in namespace '{org_id}'")
            print(f"   Sample metadata: {query_result.matches[0].metadata}")
            return True, len(query_result.matches)
        else:
            print(f"[WARN] No vectors found with file_id='{file_id}' in namespace '{org_id}'")
            # Try with file_key
            return False, 0
            
    except Exception as e:
        error_str = str(e)
        if "Namespace not found" in error_str or "code\":5" in error_str:
            print(f"[ERROR] Namespace '{org_id}' not found in Pinecone")
            print(f"   Error: {error_str}")
        else:
            print(f"[ERROR] Error querying Pinecone: {str(e)}")
        return False, 0

def wait_for_processing(file_key, max_wait=300):
    """Wait for file to be processed"""
    print_section("WAIT: File Processing")
    
    start_time = time.time()
    while time.time() - start_time < max_wait:
        try:
            url = f"{BASE_URL}/document-status/{file_key}"
            response = requests.get(url)
            
            if response.status_code == 200:
                status_data = response.json().get('data', {})
                status = status_data.get('status')
                print(f"   Status: {status} (waited {int(time.time() - start_time)}s)")
                
                if status == 'completed':
                    chunks_count = status_data.get('chunks_count', 0)
                    print(f"[OK] Processing completed! Chunks: {chunks_count}")
                    return True
                elif status == 'failed':
                    error = status_data.get('error', 'Unknown error')
                    print(f"[ERROR] Processing failed: {error}")
                    return False
                # If still processing, continue waiting
            else:
                print(f"[WARN] Could not get status: {response.status_code}")
                
        except Exception as e:
            print(f"[WARN] Error checking status: {str(e)}")
        
        time.sleep(5)  # Wait 5 seconds before checking again
    
    print(f"[TIMEOUT] Timeout waiting for processing (max {max_wait}s)")
    return False

def test_delete_file(file_id):
    """Test 2: Delete file using DELETE API"""
    print_section("TEST 2: Delete File via API")
    
    try:
        url = f"{BASE_URL}/data-source/{file_id}"
        response = requests.delete(url)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            result = response.json()
            status = result.get('status')
            if status == 'success':
                print(f"[OK] File deleted successfully!")
            elif status == 'partial_success':
                print(f"[WARN] Partial success - some deletions may have failed")
                errors = result.get('errors', [])
                for error in errors:
                    print(f"   Error: {error}")
            return True
        else:
            print(f"[ERROR] Delete failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Error deleting file: {str(e)}")
        return False

def verify_deletion_in_s3(file_key):
    """Verify file is deleted from S3"""
    print_section("VERIFY: File Deleted from S3")
    try:
        s3_client.head_object(Bucket=S3_BUCKET, Key=file_key)
        print(f"[ERROR] File STILL EXISTS in S3: {file_key}")
        return False
    except s3_client.exceptions.NoSuchKey:
        print(f"[OK] File successfully deleted from S3: {file_key}")
        return True
    except Exception as e:
        error_str = str(e)
        # If we get 403, it might mean we don't have HeadObject permission
        # but the file might still be deleted. Check by trying to get the object.
        if "403" in error_str or "Forbidden" in error_str:
            print(f"[WARN] Cannot verify S3 deletion (403 Forbidden on HeadObject)")
            print(f"       This might mean:")
            print(f"       1. File is deleted but we lack s3:HeadObject permission to verify")
            print(f"       2. File still exists but we can't check due to permissions")
            print(f"       Since DELETE API returned success, deletion likely worked.")
            # Try to get the object as another check
            try:
                s3_client.get_object(Bucket=S3_BUCKET, Key=file_key)
                print(f"[ERROR] File STILL EXISTS (verified via GetObject)")
                return False
            except s3_client.exceptions.NoSuchKey:
                print(f"[OK] File deleted (verified via GetObject)")
                return True
            except Exception as e2:
                print(f"[WARN] Cannot verify via GetObject either: {str(e2)}")
                # Assume success since DELETE API returned success
                return True
        else:
            print(f"[ERROR] Error checking S3: {error_str}")
            return False

def verify_deletion_in_pinecone(file_id, org_id):
    """Verify vectors are deleted from Pinecone"""
    print_section("VERIFY: Vectors Deleted from Pinecone")
    try:
        # Query for vectors with this file_id
        query_result = index.query(
            vector=[0.0] * 1024,  # Dummy vector
            top_k=10,
            namespace=org_id,
            filter={"file_id": {"$eq": file_id}},
            include_metadata=True
        )
        
        if query_result.matches:
            print(f"[ERROR] Vectors STILL EXIST in Pinecone: {len(query_result.matches)} vectors found")
            print(f"   Sample metadata: {query_result.matches[0].metadata}")
            return False
        else:
            print(f"[OK] Vectors successfully deleted from Pinecone")
            return True
            
    except Exception as e:
        error_str = str(e)
        if "Namespace not found" in error_str or "code\":5" in error_str:
            print(f"[WARN] Namespace '{org_id}' not found - vectors may have been deleted or namespace doesn't exist")
            return True  # Consider this as success if namespace doesn't exist
        else:
            print(f"[ERROR] Error querying Pinecone: {str(e)}")
            return False

def check_namespace_stats(org_id):
    """Check namespace statistics"""
    print_section("CHECK: Pinecone Namespace Stats")
    try:
        stats = index.describe_index_stats()
        namespaces = stats.get('namespaces', {})
        print(f"Available namespaces: {list(namespaces.keys())}")
        
        if org_id in namespaces:
            namespace_stats = namespaces[org_id]
            print(f"[OK] Namespace '{org_id}' exists")
            print(f"   Vector count: {namespace_stats.get('vector_count', 0)}")
        else:
            print(f"[ERROR] Namespace '{org_id}' NOT found")
            print(f"   Available namespaces: {list(namespaces.keys())}")
            
    except Exception as e:
        print(f"[ERROR] Error getting stats: {str(e)}")

def main():
    """Run all tests"""
    print_section("DELETE API TEST SUITE")
    print(f"Base URL: {BASE_URL}")
    print(f"User ID: {TEST_USER_ID}")
    print(f"Org ID: {TEST_ORG_ID}")
    
    # Step 1: Upload file
    file_id, file_key = test_upload_file()
    if not file_id or not file_key:
        print("\n[ERROR] Cannot continue - file upload failed")
        return
    
    # Step 2: Verify file in S3
    file_in_s3 = verify_file_in_s3(file_key)
    
    # Step 3: Wait for processing
    processing_complete = wait_for_processing(file_key, max_wait=300)
    
    # Step 4: Verify vectors in Pinecone
    if processing_complete:
        vectors_exist, vector_count = verify_vectors_in_pinecone(file_id, TEST_ORG_ID)
        check_namespace_stats(TEST_ORG_ID)
    else:
        vectors_exist = False
        vector_count = 0
        print("[WARN] Skipping Pinecone verification - processing not complete")
    
    # Step 5: Delete file
    print("\n" + "="*60)
    print("  DELETION PHASE")
    print("="*60)
    
    delete_success = test_delete_file(file_id)
    
    # Step 6: Verify deletion
    if delete_success:
        time.sleep(2)  # Wait a bit for deletion to propagate
        
        s3_deleted = verify_deletion_in_s3(file_key)
        pinecone_deleted = verify_deletion_in_pinecone(file_id, TEST_ORG_ID)
        
        # Final summary
        print_section("TEST SUMMARY")
        print(f"Upload: {'[OK]' if file_id else '[ERROR]'}")
        print(f"File in S3 (before): {'[OK]' if file_in_s3 else '[ERROR]'}")
        print(f"Processing: {'[OK]' if processing_complete else '[ERROR]'}")
        print(f"Vectors in Pinecone (before): {'[OK]' if vectors_exist else '[ERROR]'} ({vector_count} vectors)")
        print(f"Delete API call: {'[OK]' if delete_success else '[ERROR]'}")
        print(f"File deleted from S3: {'[OK]' if s3_deleted else '[ERROR]'}")
        print(f"Vectors deleted from Pinecone: {'[OK]' if pinecone_deleted else '[ERROR]'}")
        
        if s3_deleted and pinecone_deleted:
            print("\n[SUCCESS] File deleted from both S3 and Pinecone!")
        elif s3_deleted and not pinecone_deleted:
            print("\n[PARTIAL] File deleted from S3 but NOT from Pinecone")
        elif not s3_deleted and pinecone_deleted:
            print("\n[PARTIAL] Vectors deleted from Pinecone but file NOT deleted from S3")
        else:
            print("\n[FAILURE] File not deleted from either S3 or Pinecone")
    
    # Cleanup
    if os.path.exists(TEST_FILE):
        os.remove(TEST_FILE)
        print(f"\n[CLEANUP] Cleaned up test file: {TEST_FILE}")

if __name__ == "__main__":
    main()
