#!/usr/bin/env python3
"""
創建 pairing_records 表格的腳本
"""

import os
import psycopg2
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 從環境變數讀取資料庫連接字串
POSTGRES_CONN = os.getenv("DATABASE_URL")
if not POSTGRES_CONN:
    print("Error: Please set DATABASE_URL in .env file")
    exit(1)

def create_pairing_records_table():
    """創建 pairing_records 表格"""
    try:
        # 使用 psycopg2 直接連接
        conn = psycopg2.connect(POSTGRES_CONN)
        cursor = conn.cursor()
        
        # 創建表格的 SQL
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS pairing_records (
            id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user1_id VARCHAR(255) NOT NULL,
            user2_id VARCHAR(255) NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            extended_times INTEGER DEFAULT 0,
            duration INTEGER NOT NULL,
            rating INTEGER,
            comment TEXT,
            animal_name VARCHAR(255) NOT NULL,
            booking_id VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        cursor.execute(create_table_sql)
        print("Success: pairing_records table created successfully")
        
        # 創建索引
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_pairing_records_user1_id ON pairing_records (user1_id);",
            "CREATE INDEX IF NOT EXISTS idx_pairing_records_user2_id ON pairing_records (user2_id);",
            "CREATE INDEX IF NOT EXISTS idx_pairing_records_booking_id ON pairing_records (booking_id);",
            "CREATE INDEX IF NOT EXISTS idx_pairing_records_timestamp ON pairing_records (timestamp);"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
            print(f"Success: Index created - {index_sql.split()[-1]}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"Error: Failed to create table: {e}")
        return False

def test_database_connection():
    """測試資料庫連接"""
    try:
        engine = create_engine(POSTGRES_CONN)
        Session = sessionmaker(bind=engine)
        
        with Session() as s:
            # 測試簡單查詢
            result = s.execute(text("SELECT 1 as test"))
            test_value = result.fetchone()[0]
            
            if test_value == 1:
                print("Success: Database connection test passed")
                return True
            else:
                print("Error: Database connection test failed")
                return False
                
    except Exception as e:
        print(f"Error: Database connection test failed: {e}")
        return False

def check_table_exists():
    """檢查表格是否存在"""
    try:
        engine = create_engine(POSTGRES_CONN)
        Session = sessionmaker(bind=engine)
        
        with Session() as s:
            result = s.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'pairing_records'
                );
            """))
            exists = result.fetchone()[0]
            
            if exists:
                print("Success: pairing_records table already exists")
                return True
            else:
                print("Error: pairing_records table does not exist")
                return False
                
    except Exception as e:
        print(f"Error: Failed to check table existence: {e}")
        return False

def main():
    print("Starting Discord Bot database repair...")
    
    # 1. Test database connection
    print("\n1. Testing database connection...")
    if not test_database_connection():
        print("Error: Database connection failed, please check DATABASE_URL")
        return
    
    # 2. Check if table exists
    print("\n2. Checking pairing_records table...")
    if check_table_exists():
        print("Success: Table already exists, no need to create")
        return
    
    # 3. Create table
    print("\n3. Creating pairing_records table...")
    if create_pairing_records_table():
        print("Success: Table created successfully")
    else:
        print("Error: Table creation failed")
        return
    
    # 4. Verify creation
    print("\n4. Verifying table creation...")
    if check_table_exists():
        print("Success: Discord Bot database repair completed!")
        print("You can now restart the Discord Bot")
    else:
        print("Error: Table creation verification failed")

if __name__ == "__main__":
    main()
