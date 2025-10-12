"""
Predictive Analytics Service
Generates investigation leads and risk predictions using ML models
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class PredictiveAnalyticsService:
    """ML-based predictive analytics for investigation leads"""

    def __init__(self):
        self.models_dir = "models"
        os.makedirs(self.models_dir, exist_ok=True)
        self.risk_model = None
        self.lead_model = None
        self.scaler = StandardScaler()
        self.label_encoders = {}

    def train_risk_prediction_model(self, historical_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Train a model to predict case risk levels based on initial evidence

        Args:
            historical_cases: List of completed cases with outcomes

        Returns:
            Training results and model performance
        """
        try:
            if len(historical_cases) < 10:
                return {
                    "success": False,
                    "message": "Insufficient data for training. Need at least 10 cases.",
                    "performance": None
                }

            # Prepare training data
            features_df = self._extract_case_features(historical_cases)
            if features_df.empty:
                return {
                    "success": False,
                    "message": "No valid features extracted from cases.",
                    "performance": None
                }

            # Target variable: risk level (derived from case outcomes)
            targets = []
            for case in historical_cases:
                risk_score = self._calculate_case_risk_score(case)
                targets.append(risk_score)

            X = features_df.values
            y = np.array(targets)

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

            # Train model
            self.risk_model = GradientBoostingRegressor(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=5,
                random_state=42
            )

            self.risk_model.fit(X_train, y_train)

            # Evaluate
            y_pred = self.risk_model.predict(X_test)
            mse = np.mean((y_test - y_pred) ** 2)
            rmse = np.sqrt(mse)
            r2_score = self.risk_model.score(X_test, y_test)

            # Save model
            model_path = os.path.join(self.models_dir, "risk_prediction_model.pkl")
            joblib.dump(self.risk_model, model_path)

            performance = {
                "rmse": rmse,
                "r2_score": r2_score,
                "training_samples": len(X_train),
                "test_samples": len(X_test),
                "features_used": len(features_df.columns)
            }

            logger.info(f"Risk prediction model trained: RMSE={rmse:.3f}, R²={r2_score:.3f}")

            return {
                "success": True,
                "message": f"Risk prediction model trained successfully. RMSE: {rmse:.3f}",
                "performance": performance
            }

        except Exception as e:
            logger.error(f"Error training risk prediction model: {e}")
            return {
                "success": False,
                "message": f"Training failed: {str(e)}",
                "performance": None
            }

    def predict_case_risk(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict risk level for a new case

        Args:
            case_data: Case information and initial evidence

        Returns:
            Risk prediction with confidence scores
        """
        try:
            if self.risk_model is None:
                # Try to load saved model
                model_path = os.path.join(self.models_dir, "risk_prediction_model.pkl")
                if os.path.exists(model_path):
                    self.risk_model = joblib.load(model_path)
                else:
                    return {
                        "risk_score": 0.5,
                        "confidence": 0.0,
                        "prediction": "unknown",
                        "message": "No trained model available"
                    }

            # Extract features from case data
            features_df = self._extract_single_case_features(case_data)
            if features_df.empty:
                return {
                    "risk_score": 0.5,
                    "confidence": 0.0,
                    "prediction": "unknown",
                    "message": "Could not extract features from case data"
                }

            X = features_df.values
            risk_score = self.risk_model.predict(X)[0]

            # Determine risk level
            if risk_score >= 0.8:
                prediction = "critical"
            elif risk_score >= 0.6:
                prediction = "high"
            elif risk_score >= 0.4:
                prediction = "medium"
            elif risk_score >= 0.2:
                prediction = "low"
            else:
                prediction = "minimal"

            # Calculate confidence based on feature completeness
            feature_completeness = len(features_df.dropna().columns) / len(features_df.columns)
            confidence = min(risk_score * feature_completeness, 1.0)

            return {
                "risk_score": float(risk_score),
                "confidence": float(confidence),
                "prediction": prediction,
                "message": f"Case predicted as {prediction} risk"
            }

        except Exception as e:
            logger.error(f"Error predicting case risk: {e}")
            return {
                "risk_score": 0.5,
                "confidence": 0.0,
                "prediction": "unknown",
                "message": f"Prediction failed: {str(e)}"
            }

    def generate_investigation_leads(self, case_data: Dict[str, Any], historical_patterns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate investigation leads based on similar historical cases

        Args:
            case_data: Current case information
            historical_patterns: Similar historical cases

        Returns:
            List of investigation leads with confidence scores
        """
        try:
            leads = []

            # Lead 1: Similar case patterns
            if len(historical_patterns) > 0:
                similar_cases = self._find_similar_cases(case_data, historical_patterns)
                if similar_cases:
                    leads.append({
                        "lead_type": "similar_cases",
                        "title": "Similar Historical Cases",
                        "description": f"Found {len(similar_cases)} similar cases that may provide investigation insights",
                        "confidence": min(len(similar_cases) * 0.1, 0.9),
                        "recommendations": [
                            "Review investigation methods used in similar cases",
                            "Check for common suspects or patterns",
                            "Consider evidence preservation techniques from similar cases"
                        ],
                        "related_cases": similar_cases[:5]  # Top 5 similar cases
                    })

            # Lead 2: Communication pattern analysis
            comm_patterns = self._analyze_communication_patterns(case_data)
            if comm_patterns:
                leads.append({
                    "lead_type": "communication_patterns",
                    "title": "Unusual Communication Patterns",
                    "description": comm_patterns["description"],
                    "confidence": comm_patterns["confidence"],
                    "recommendations": comm_patterns["recommendations"],
                    "entities": comm_patterns["entities"]
                })

            # Lead 3: Timeline analysis
            timeline_insights = self._analyze_timeline_gaps(case_data)
            if timeline_insights:
                leads.append({
                    "lead_type": "timeline_analysis",
                    "title": "Timeline Investigation Leads",
                    "description": timeline_insights["description"],
                    "confidence": timeline_insights["confidence"],
                    "recommendations": timeline_insights["recommendations"],
                    "time_periods": timeline_insights["gaps"]
                })

            # Lead 4: Network analysis
            network_leads = self._analyze_network_connections(case_data)
            if network_leads:
                leads.append({
                    "lead_type": "network_analysis",
                    "title": "Network Connection Leads",
                    "description": network_leads["description"],
                    "confidence": network_leads["confidence"],
                    "recommendations": network_leads["recommendations"],
                    "connections": network_leads["key_connections"]
                })

            # Sort leads by confidence
            leads.sort(key=lambda x: x["confidence"], reverse=True)

            logger.info(f"Generated {len(leads)} investigation leads")
            return leads

        except Exception as e:
            logger.error(f"Error generating investigation leads: {e}")
            return []

    def _extract_case_features(self, cases: List[Dict[str, Any]]) -> pd.DataFrame:
        """Extract ML features from case data"""
        try:
            features = []

            for case in cases:
                case_features = {
                    'case_duration_days': self._calculate_case_duration(case),
                    'evidence_count': case.get('evidence_count', 0),
                    'communication_count': case.get('communication_count', 0),
                    'unique_contacts': case.get('unique_contacts', 0),
                    'foreign_numbers_ratio': case.get('foreign_numbers_ratio', 0.0),
                    'late_night_activity': case.get('late_night_activity', 0.0),
                    'case_priority': self._encode_priority(case.get('priority', 'medium')),
                    'has_critical_evidence': 1 if case.get('has_critical_evidence', False) else 0,
                    'cross_case_links': case.get('cross_case_links', 0),
                    'anomaly_count': case.get('anomaly_count', 0)
                }
                features.append(case_features)

            return pd.DataFrame(features)

        except Exception as e:
            logger.error(f"Error extracting case features: {e}")
            return pd.DataFrame()

    def _extract_single_case_features(self, case: Dict[str, Any]) -> pd.DataFrame:
        """Extract features from a single case"""
        try:
            features = {
                'case_duration_days': self._calculate_case_duration(case),
                'evidence_count': case.get('evidence_count', 0),
                'communication_count': case.get('communication_count', 0),
                'unique_contacts': case.get('unique_contacts', 0),
                'foreign_numbers_ratio': case.get('foreign_numbers_ratio', 0.0),
                'late_night_activity': case.get('late_night_activity', 0.0),
                'case_priority': self._encode_priority(case.get('priority', 'medium')),
                'has_critical_evidence': 1 if case.get('has_critical_evidence', False) else 0,
                'cross_case_links': case.get('cross_case_links', 0),
                'anomaly_count': case.get('anomaly_count', 0)
            }

            return pd.DataFrame([features])

        except Exception as e:
            logger.error(f"Error extracting single case features: {e}")
            return pd.DataFrame()

    def _calculate_case_duration(self, case: Dict[str, Any]) -> int:
        """Calculate case duration in days"""
        try:
            created_date = case.get('created_at', datetime.now())
            if isinstance(created_date, str):
                created_date = pd.to_datetime(created_date)

            # For active cases, use current date
            end_date = case.get('closed_at') or datetime.now()
            if isinstance(end_date, str):
                end_date = pd.to_datetime(end_date)

            duration = (end_date - created_date).days
            return max(1, duration)  # Minimum 1 day

        except:
            return 30  # Default 30 days

    def _calculate_case_risk_score(self, case: Dict[str, Any]) -> float:
        """Calculate risk score based on case outcomes"""
        try:
            # Risk factors
            risk_score = 0.0

            # Case outcome
            outcome = case.get('outcome', '').lower()
            if 'conviction' in outcome or 'guilty' in outcome:
                risk_score += 0.8
            elif 'arrest' in outcome:
                risk_score += 0.6
            elif 'investigation' in outcome:
                risk_score += 0.4

            # Evidence strength
            if case.get('has_critical_evidence', False):
                risk_score += 0.2

            # Cross-case connections
            cross_links = case.get('cross_case_links', 0)
            risk_score += min(cross_links * 0.1, 0.3)

            # Anomalies detected
            anomalies = case.get('anomaly_count', 0)
            risk_score += min(anomalies * 0.05, 0.2)

            return min(risk_score, 1.0)

        except Exception as e:
            logger.error(f"Error calculating case risk score: {e}")
            return 0.5

    def _encode_priority(self, priority: str) -> int:
        """Encode priority string to numeric value"""
        priority_map = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
        return priority_map.get(priority.lower(), 2)

    def _find_similar_cases(self, case_data: Dict[str, Any], historical_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find cases similar to the current one"""
        try:
            similar_cases = []

            current_features = {
                'communication_count': case_data.get('communication_count', 0),
                'unique_contacts': case_data.get('unique_contacts', 0),
                'foreign_ratio': case_data.get('foreign_numbers_ratio', 0),
                'priority': self._encode_priority(case_data.get('priority', 'medium'))
            }

            for hist_case in historical_cases:
                similarity_score = self._calculate_case_similarity(current_features, hist_case)
                if similarity_score > 0.6:  # 60% similarity threshold
                    similar_cases.append({
                        'case_id': hist_case.get('id'),
                        'case_number': hist_case.get('case_number'),
                        'similarity_score': similarity_score,
                        'outcome': hist_case.get('outcome'),
                        'key_insights': hist_case.get('key_insights', [])
                    })

            return sorted(similar_cases, key=lambda x: x['similarity_score'], reverse=True)

        except Exception as e:
            logger.error(f"Error finding similar cases: {e}")
            return []

    def _calculate_case_similarity(self, case1_features: Dict[str, Any], case2: Dict[str, Any]) -> float:
        """Calculate similarity between two cases"""
        try:
            similarity = 0.0
            total_factors = 0

            # Communication count similarity
            if case1_features.get('communication_count', 0) > 0:
                comm_ratio = min(case2.get('communication_count', 0) / case1_features['communication_count'], 2)
                similarity += (1 - abs(1 - comm_ratio)) * 0.3
                total_factors += 0.3

            # Contact similarity
            if case1_features.get('unique_contacts', 0) > 0:
                contact_ratio = min(case2.get('unique_contacts', 0) / case1_features['unique_contacts'], 2)
                similarity += (1 - abs(1 - contact_ratio)) * 0.2
                total_factors += 0.2

            # Foreign number ratio similarity
            foreign_diff = abs(case1_features.get('foreign_ratio', 0) - case2.get('foreign_numbers_ratio', 0))
            similarity += (1 - foreign_diff) * 0.3
            total_factors += 0.3

            # Priority similarity
            priority_diff = abs(case1_features.get('priority', 2) - self._encode_priority(case2.get('priority', 'medium')))
            similarity += (1 - priority_diff / 4) * 0.2
            total_factors += 0.2

            return similarity / total_factors if total_factors > 0 else 0.0

        except:
            return 0.0

    def _analyze_communication_patterns(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze communication patterns for leads"""
        try:
            foreign_ratio = case_data.get('foreign_numbers_ratio', 0)
            late_night_activity = case_data.get('late_night_activity', 0)

            if foreign_ratio > 0.3 or late_night_activity > 5:
                return {
                    "description": f"Case shows unusual communication patterns with {foreign_ratio*100:.1f}% foreign numbers and {late_night_activity} late-night activities",
                    "confidence": min((foreign_ratio + late_night_activity/10) / 2, 0.9),
                    "recommendations": [
                        "Investigate purpose of frequent foreign communications",
                        "Check travel records during late-night activity periods",
                        "Cross-reference foreign numbers with international watchlists"
                    ],
                    "entities": case_data.get('foreign_numbers', [])
                }
            return None

        except Exception as e:
            logger.error(f"Error analyzing communication patterns: {e}")
            return None

    def _analyze_timeline_gaps(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze timeline for investigation gaps"""
        try:
            # This would analyze communication gaps
            # For now, return mock analysis
            return {
                "description": "Timeline analysis reveals potential investigation gaps",
                "confidence": 0.6,
                "recommendations": [
                    "Investigate periods with no communication activity",
                    "Cross-reference timeline gaps with known events",
                    "Check for data collection gaps during critical periods"
                ],
                "gaps": ["2024-01-15 to 2024-01-20", "2024-02-01 to 2024-02-05"]
            }
        except Exception as e:
            logger.error(f"Error analyzing timeline gaps: {e}")
            return None

    def _analyze_network_connections(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze network connections for leads"""
        try:
            cross_links = case_data.get('cross_case_links', 0)

            if cross_links > 0:
                return {
                    "description": f"Case has {cross_links} connections to other investigations",
                    "confidence": min(cross_links * 0.1, 0.8),
                    "recommendations": [
                        "Review evidence from connected cases",
                        "Identify common suspects across cases",
                        "Check for patterns in criminal methodology"
                    ],
                    "key_connections": case_data.get('key_connections', [])
                }
            return None

        except Exception as e:
            logger.error(f"Error analyzing network connections: {e}")
            return None


# Global instance
predictive_service = PredictiveAnalyticsService()
