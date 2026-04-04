import sys
import os
import json
import asyncio
from datetime import datetime

# Add the app directory to the path so we can import the service
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from app.services.anomaly_detector import anomaly_detector
    print("✅ Successfully imported anomaly_detector")
except ImportError as e:
    print(f"❌ Error importing anomaly_detector: {e}")
    sys.exit(1)

async def verify_models():
    # 1. Check if models are loaded
    bundle = anomaly_detector.model_bundle
    print(f"\n--- Model Loading Status ---")
    print(f"Bundle Loaded: {'✅' if bundle.is_loaded else '❌'}")
    print(f"XGBoost Model: {'✅' if bundle.xgb_model else '❌'}")
    print(f"DNN Model:     {'✅' if bundle.dnn_model else '❌'}")
    print(f"LSTM Model:    {'✅' if bundle.lstm_model else '❌'}")
    
    if bundle.load_errors:
        print("\nLoad Errors:")
        for err in bundle.load_errors:
            print(f"- {err}")
            
    # 2. Run a sample detection
    print(f"\n--- Running Sample Detection ---")
    sample_case = {
        "communications": [
            {
                "phone_number": "+919876543210",
                "timestamp": datetime.now().isoformat(),
                "duration": 45,
                "frequency": 2,
                "source_type": "mobile",
                "unique_contacts": 1
            },
            {
                "phone_number": "+441234567890", # Foreign number
                "timestamp": datetime.now().isoformat(),
                "duration": 3600, # Large duration
                "frequency": 150, # High frequency
                "source_type": "network_device",
                "unique_contacts": 15
            }
        ]
    }
    
    try:
        results = anomaly_detector.detect_all_anomalies(sample_case)
        print("✅ Detection execution successful")
        
        summary = results.get('summary', {})
        print(f"\nSummary:")
        print(f"- Total Anomalies: {summary.get('total_anomalies', 0)}")
        print(f"- Advanced Anomalies: {summary.get('advanced_anomalies', 0)}")
        print(f"- Risk Level: {summary.get('risk_level', 'none')}")
        print(f"- Models Used: {', '.join(summary.get('models_used', []))}")
        
        advanced = results.get('advanced_anomalies', {})
        if any(advanced.values()):
            print("\nAdvanced Detections:")
            for model, anomalies in advanced.items():
                if anomalies:
                    print(f"- {model}: {len(anomalies)} anomalies found")
                    for a in anomalies:
                        print(f"  * {a.get('description')}")
        else:
            print("\nNo advanced anomalies detected with current thresholds.")
            
    except Exception as e:
        print(f"❌ Error during detection: {e}")

if __name__ == "__main__":
    if asyncio.get_event_loop().is_running():
        # If running in an environment with an existing loop (like some notebooks)
        import nest_asyncio
        nest_asyncio.apply()
        
    asyncio.run(verify_models())
