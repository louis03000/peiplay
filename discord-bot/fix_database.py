#!/usr/bin/env python3
"""
修復資料庫問題的腳本
1. 創建缺少的 pairing_records 表格
2. 測試資料庫連接
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
        
        # 創建表格
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS pairing_records (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user1_id TEXT NOT NULL,
            user2_id TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            extended_times INTEGER DEFAULT 0,
            duration INTEGER NOT NULL,
            rating INTEGER,
            comment TEXT,
            animal_name TEXT NOT NULL,
            booking_id TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """
        
        cursor.execute(create_table_sql)
        
        # 創建索引
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_pairing_records_booking_id ON pairing_records(booking_id);",
            "CREATE INDEX IF NOT EXISTS idx_pairing_records_user1_id ON pairing_records(user1_id);",
            "CREATE INDEX IF NOT EXISTS idx_pairing_records_user2_id ON pairing_records(user2_id);",
            "CREATE INDEX IF NOT EXISTS idx_pairing_records_timestamp ON pairing_records(timestamp);"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        conn.commit()
        print("Success: pairing_records table created successfully")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: Failed to create table: {e}")
        return False
    
    return True

def test_database_connection():
    """測試資料庫連接"""
    try:
        engine = create_engine(
            POSTGRES_CONN,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False
        )
        
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

def main():
    print("Starting database repair...")
    
    # 1. Create missing tables
    print("\n1. Creating pairing_records table...")
    if create_pairing_records_table():
        print("Success: Table creation completed")
    else:
        print("Error: Table creation failed")
        return
    
    # 2. Test database connection
    print("\n2. Testing database connection...")
    if test_database_connection():
        print("Success: Connection test completed")
    else:
        print("Error: Connection test failed")
        return
    
    print("\nDatabase repair completed!")
    print("You can now restart the Discord bot.")

if __name__ == "__main__":
    main()
