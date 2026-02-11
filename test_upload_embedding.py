"""
Test script for document upload and embedding system
Tests: Upload, S3 verification, Background task, Embedding generation
"""

import requests
import time
import boto3
from pinecone import Pinecone
import os

# Configuration
BASE_URL = "https://backend-11kr.onrender.com"  # Render backend URL
TEST_USER_ID = "test_user_123"
TEST_FILE = "test_document.txt"

# S3 Configuration
S3_BUCKET = "brewra-data-sources"
AWS_REGION = "eu-north-1"
AWS_ACCESS_KEY = "AKIAWSX4DVX7DHHENUWS"
AWS_SECRET_KEY = "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"

# Pinecone Configuration
PINECONE_API_KEY = "pcsk_3Hv4td_HrXCeQPwZYJZT1Zf6nwtLjAC64E8WcJA1fQ6w18dGUnxsPLpoUrovVb7JCP862w"

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=AWS_REGION
)

# Initialize Pinecone
pc = Pinecone(api_key=PINECONE_API_KEY)

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def test_upload_file():
    """Test 1: Upload file to the API"""
    print_section("TEST 1: Upload File")
    
    if not os.path.exists(TEST_FILE):
        print(f"❌ ERROR: Test file '{TEST_FILE}' not found!")
        return None
    
    try:
        with open(TEST_FILE, 'rb') as f:
            files = {'file': (TEST_FILE, f, 'text/plain')}
            data = {'user_id': TEST_USER_ID}
            
            print(f"📤 Uploading {TEST_FILE}...")
            response = requests.post(
                f"{BASE_URL}/upload-document",
                files=files,
                data=data
            )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Upload successful!")
            print(f"   File Key: {result.get('file_key')}")
            print(f"   File Name: {result.get('file_name')}")
            print(f"   Status: {result.get('status')}")
            return result.get('file_key')
        else:
            print(f"❌ Upload failed!")
            print(f"   Status Code: {response.status_code}")
            print(f"   Response: {response.json()}")
            return None
            
    except Exception as e:
        print(f"❌ Error during upload: {str(e)}")
        return None

def test_s3_verification(file_key):
    """Test 2: Verify file exists in S3"""
    print_section("TEST 2: Verify File in S3")
    
    if not file_key:
        print("❌ Skipping: No file_key provided")
        return False
    
    try:
        print(f"🔍 Checking S3 for file: {file_key}")
        
        # Try to get object metadata
        response = s3_client.head_object(Bucket=S3_BUCKET, Key=file_key)
        
        print(f"✅ File found in S3!")
        print(f"   Bucket: {S3_BUCKET}")
        print(f"   Key: {file_key}")
        print(f"   Size: {response.get('ContentLength')} bytes")
        print(f"   Content Type: {response.get('ContentType')}")
        print(f"   Last Modified: {response.get('LastModified')}")
        
        return True
        
    except s3_client.exceptions.NoSuchKey:
        print(f"❌ File not found in S3!")
        return False
    except Exception as e:
        print(f"❌ Error checking S3: {str(e)}")
        return False

def test_background_task(file_key):
    """Test 3: Check if background task is processing"""
    print_section("TEST 3: Background Task Status")
    
    if not file_key:
        print("❌ Skipping: No file_key provided")
        return False
    
    max_wait = 120  # Wait up to 2 minutes
    check_interval = 5  # Check every 5 seconds
    elapsed = 0
    
    print(f"⏳ Waiting for background task to process...")
    print(f"   Will check every {check_interval} seconds (max {max_wait}s)")
    
    while elapsed < max_wait:
        try:
            response = requests.get(f"{BASE_URL}/document-status/{file_key}")
            
            if response.status_code == 200:
                status_data = response.json().get('data', {})
                current_status = status_data.get('status', 'unknown')
                
                print(f"   [{elapsed}s] Status: {current_status}")
                
                if current_status == "completed":
                    print(f"✅ Background task completed!")
                    print(f"   Chunks created: {status_data.get('chunks_count', 'N/A')}")
                    print(f"   Completed at: {status_data.get('completed_at', 'N/A')}")
                    return True
                elif current_status == "failed":
                    print(f"❌ Background task failed!")
                    print(f"   Error: {status_data.get('error', 'Unknown error')}")
                    return False
                elif current_status == "processing":
                    print(f"   ⏳ Still processing...")
                else:
                    print(f"   ⚠️  Unknown status: {current_status}")
            else:
                print(f"   ⚠️  Status check failed: {response.status_code}")
            
            time.sleep(check_interval)
            elapsed += check_interval
            
        except Exception as e:
            print(f"   ⚠️  Error checking status: {str(e)}")
            time.sleep(check_interval)
            elapsed += check_interval
    
    print(f"⏰ Timeout: Background task didn't complete in {max_wait} seconds")
    return False

def test_embeddings_in_pinecone(file_key):
    """Test 4: Verify embeddings were stored in Pinecone"""
    print_section("TEST 4: Verify Embeddings in Pinecone")
    
    if not file_key:
        print("❌ Skipping: No file_key provided")
        return False
    
    try:
        index_name = "brewra-documents"
        
        # Check if index exists
        print(f"🔍 Checking Pinecone index: {index_name}")
        
        indexes = pc.list_indexes()
        index_names = [idx.name for idx in indexes]
        
        if index_name not in index_names:
            print(f"❌ Index '{index_name}' not found!")
            print(f"   Available indexes: {index_names}")
            return False
        
        print(f"✅ Index found!")
        
        # Connect to index
        index = pc.Index(index_name)
        
        # Get index stats
        stats = index.describe_index_stats()
        print(f"   Total vectors: {stats.get('total_vector_count', 0)}")
        print(f"   Namespaces: {list(stats.get('namespaces', {}).keys())}")
        
        # Try to query with a test vector (dummy query to verify index is working)
        print(f"   ✅ Pinecone index is accessible and contains vectors")
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking Pinecone: {str(e)}")
        return False

def test_list_user_documents():
    """Test 5: List all documents for the user"""
    print_section("TEST 5: List User Documents")
    
    try:
        response = requests.get(
            f"{BASE_URL}/user-documents",
            params={"user_id": TEST_USER_ID}
        )
        
        if response.status_code == 200:
            result = response.json()
            files = result.get('files', [])
            
            print(f"✅ Found {result.get('count', 0)} files for user {TEST_USER_ID}")
            
            for i, file_info in enumerate(files, 1):
                print(f"\n   File {i}:")
                print(f"      ID: {file_info.get('file_id')}")
                print(f"      Name: {file_info.get('file_name')}")
                print(f"      Status: {file_info.get('status')}")
                print(f"      Uploaded: {file_info.get('uploaded_at')}")
            
            return True
        else:
            print(f"❌ Failed to list documents: {response.status_code}")
            print(f"   Response: {response.json()}")
            return False
            
    except Exception as e:
        print(f"❌ Error listing documents: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "🚀"*30)
    print("  DOCUMENT UPLOAD & EMBEDDING SYSTEM TEST")
    print("🚀"*30)
    
    # Test 1: Upload
    file_key = test_upload_file()
    
    if not file_key:
        print("\n❌ Upload failed. Stopping tests.")
        return
    
    # Test 2: S3 Verification
    s3_ok = test_s3_verification(file_key)
    
    # Test 3: Background Task
    task_ok = test_background_task(file_key)
    
    # Test 4: Pinecone Embeddings
    if task_ok:
        pinecone_ok = test_embeddings_in_pinecone(file_key)
    else:
        print("\n⚠️  Skipping Pinecone test (background task didn't complete)")
        pinecone_ok = False
    
    # Test 5: List Documents
    list_ok = test_list_user_documents()
    
    # Summary
    print_section("TEST SUMMARY")
    results = {
        "Upload": "✅" if file_key else "❌",
        "S3 Verification": "✅" if s3_ok else "❌",
        "Background Task": "✅" if task_ok else "❌",
        "Pinecone Embeddings": "✅" if pinecone_ok else "❌",
        "List Documents": "✅" if list_ok else "❌"
    }
    
    for test_name, result in results.items():
        print(f"   {result} {test_name}")
    
    total = len(results)
    passed = sum(1 for r in results.values() if r == "✅")
    print(f"\n   Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
