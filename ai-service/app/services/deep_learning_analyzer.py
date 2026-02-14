import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans, DBSCAN
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import Dense, LSTM, Conv1D, MaxPooling1D, Flatten, Embedding, Dropout
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple
import json
from datetime import datetime
import re

logger = logging.getLogger(__name__)

class DeepLearningEvidenceAnalyzer:
    """
    Advanced deep learning models for evidence analysis and classification
    """

    def __init__(self):
        self.models = {}
        self.vectorizers = {}
        self.scalers = {}
        self.encoders = {}
        self.is_trained = False

        # Initialize default architectures
        self._initialize_models()

    def _initialize_models(self):
        """Initialize deep learning model architectures"""
        try:
            # Evidence type classification model
            self.evidence_classifier = self._build_evidence_classifier()

            # Anomaly detection autoencoder
            self.anomaly_detector = self._build_anomaly_detector()

            # Pattern recognition CNN
            self.pattern_recognizer = self._build_pattern_recognizer()

            # Temporal sequence analyzer (LSTM)
            self.temporal_analyzer = self._build_temporal_analyzer()

            logger.info("Deep learning models initialized successfully")

        except Exception as e:
            logger.error(f"Error initializing deep learning models: {e}")

    def _build_evidence_classifier(self) -> Sequential:
        """Build evidence type classification model"""
        model = Sequential([
            Dense(256, activation='relu', input_shape=(100,)),
            Dropout(0.3),
            Dense(128, activation='relu'),
            Dropout(0.2),
            Dense(64, activation='relu'),
            Dense(10, activation='softmax')  # 10 evidence categories
        ])

        model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )

        return model

    def _build_anomaly_detector(self) -> Model:
        """Build autoencoder for anomaly detection"""
        # Encoder
        input_layer = keras.Input(shape=(100,))
        encoded = Dense(64, activation='relu')(input_layer)
        encoded = Dense(32, activation='relu')(encoded)
        encoded = Dense(16, activation='relu')(encoded)

        # Decoder
        decoded = Dense(32, activation='relu')(encoded)
        decoded = Dense(64, activation='relu')(decoded)
        decoded = Dense(100, activation='sigmoid')(decoded)

        # Autoencoder model
        autoencoder = Model(input_layer, decoded)
        autoencoder.compile(optimizer='adam', loss='mse')

        return autoencoder

    def _build_pattern_recognizer(self) -> Sequential:
        """Build CNN for pattern recognition"""
        model = Sequential([
            Conv1D(64, 3, activation='relu', input_shape=(100, 1)),
            MaxPooling1D(2),
            Conv1D(128, 3, activation='relu'),
            MaxPooling1D(2),
            Flatten(),
            Dense(64, activation='relu'),
            Dropout(0.3),
            Dense(32, activation='relu'),
            Dense(5, activation='softmax')  # 5 pattern categories
        ])

        model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )

        return model

    def _build_temporal_analyzer(self) -> Sequential:
        """Build LSTM for temporal pattern analysis"""
        model = Sequential([
            LSTM(128, input_shape=(10, 20), return_sequences=True),
            Dropout(0.2),
            LSTM(64),
            Dropout(0.2),
            Dense(32, activation='relu'),
            Dense(3, activation='softmax')  # 3 temporal patterns
        ])

        model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )

        return model

    async def train_evidence_classifier(self, training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Train the evidence classification model

        Args:
            training_data: List of evidence samples with features and labels

        Returns:
            Training results and metrics
        """
        try:
            logger.info(f"Training evidence classifier with {len(training_data)} samples")

            if len(training_data) < 50:
                return {
                    'success': False,
                    'error': 'Insufficient training data. Minimum 50 samples required.'
                }

            # Extract features and labels
            features, labels = self._extract_evidence_features(training_data)

            if len(features) == 0:
                return {
                    'success': False,
                    'error': 'No valid features extracted from training data'
                }

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                features, labels, test_size=0.2, random_state=42
            )

            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)

            # Encode labels
            encoder = LabelEncoder()
            y_train_encoded = encoder.fit_transform(y_train)
            y_test_encoded = encoder.transform(y_test)

            # Convert to categorical
            y_train_cat = keras.utils.to_categorical(y_train_encoded)
            y_test_cat = keras.utils.to_categorical(y_test_encoded)

            # Train model
            history = self.evidence_classifier.fit(
                X_train_scaled, y_train_cat,
                epochs=50,
                batch_size=32,
                validation_split=0.2,
                verbose=0,
                callbacks=[
                    keras.callbacks.EarlyStopping(
                        monitor='val_loss',
                        patience=10,
                        restore_best_weights=True
                    )
                ]
            )

            # Evaluate
            loss, accuracy = self.evidence_classifier.evaluate(X_test_scaled, y_test_cat, verbose=0)

            # Store trained components
            self.scalers['evidence_classifier'] = scaler
            self.encoders['evidence_classifier'] = encoder
            self.models['evidence_classifier'] = True

            return {
                'success': True,
                'accuracy': float(accuracy),
                'loss': float(loss),
                'epochs_trained': len(history.history['loss']),
                'final_val_accuracy': float(history.history['val_accuracy'][-1]),
                'training_samples': len(X_train),
                'test_samples': len(X_test)
            }

        except Exception as e:
            logger.error(f"Error training evidence classifier: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def classify_evidence(self, evidence_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classify evidence using trained deep learning model

        Args:
            evidence_data: Evidence data to classify

        Returns:
            Classification results with confidence scores
        """
        try:
            if 'evidence_classifier' not in self.models:
                return {
                    'success': False,
                    'error': 'Evidence classifier not trained'
                }

            # Extract features
            features = self._extract_single_evidence_features(evidence_data)

            if features is None:
                return {
                    'success': False,
                    'error': 'Could not extract features from evidence data'
                }

            # Scale features
            scaler = self.scalers.get('evidence_classifier')
            if scaler:
                features_scaled = scaler.transform([features])
            else:
                features_scaled = features.reshape(1, -1)

            # Predict
            predictions = self.evidence_classifier.predict(features_scaled, verbose=0)

            # Decode predictions
            encoder = self.encoders.get('evidence_classifier')
            predicted_class_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_class_idx])

            predicted_class = 'unknown'
            if encoder:
                try:
                    predicted_class = encoder.inverse_transform([predicted_class_idx])[0]
                except:
                    pass

            # Get top 3 predictions
            top_indices = np.argsort(predictions[0])[-3:][::-1]
            top_predictions = []

            for idx in top_indices:
                confidence_score = float(predictions[0][idx])
                class_name = 'unknown'
                if encoder:
                    try:
                        class_name = encoder.inverse_transform([idx])[0]
                    except:
                        pass

                top_predictions.append({
                    'class': class_name,
                    'confidence': confidence_score
                })

            return {
                'success': True,
                'predicted_class': predicted_class,
                'confidence': confidence,
                'top_predictions': top_predictions,
                'all_probabilities': predictions[0].tolist()
            }

        except Exception as e:
            logger.error(f"Error classifying evidence: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def detect_anomalies_dl(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detect anomalies using deep learning autoencoder

        Args:
            data: Data to analyze for anomalies

        Returns:
            List of detected anomalies
        """
        try:
            # Extract features
            features = []
            for item in data:
                feature_vector = self._extract_anomaly_features(item)
                if feature_vector is not None:
                    features.append(feature_vector)

            if len(features) < 10:
                return []

            features_array = np.array(features)

            # Train autoencoder if not trained
            if 'anomaly_detector' not in self.models:
                self.anomaly_detector.fit(
                    features_array, features_array,
                    epochs=100,
                    batch_size=32,
                    verbose=0,
                    validation_split=0.2,
                    callbacks=[
                        keras.callbacks.EarlyStopping(
                            monitor='val_loss',
                            patience=15,
                            restore_best_weights=True
                        )
                    ]
                )
                self.models['anomaly_detector'] = True

            # Get reconstruction errors
            reconstructions = self.anomaly_detector.predict(features_array, verbose=0)
            mse_errors = np.mean(np.power(features_array - reconstructions, 2), axis=1)

            # Calculate threshold (95th percentile)
            threshold = np.percentile(mse_errors, 95)

            anomalies = []
            for i, error in enumerate(mse_errors):
                if error > threshold:
                    confidence = min(error / (threshold * 2), 1.0)

                    anomalies.append({
                        'anomaly_type': 'deep_learning_anomaly',
                        'confidence': float(confidence),
                        'description': f'Deep learning detected anomaly with reconstruction error {error:.4f}',
                        'reconstruction_error': float(error),
                        'threshold': float(threshold),
                        'data_index': i,
                        'features': features_array[i].tolist()[:10]  # First 10 features
                    })

            return sorted(anomalies, key=lambda x: x['confidence'], reverse=True)

        except Exception as e:
            logger.error(f"Error in deep learning anomaly detection: {e}")
            return []

    async def analyze_patterns(self, pattern_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze patterns using CNN-based pattern recognition

        Args:
            pattern_data: Data containing patterns to analyze

        Returns:
            Pattern analysis results
        """
        try:
            # Extract pattern features
            features = []
            labels = []

            for item in pattern_data:
                feature_vector = self._extract_pattern_features(item)
                if feature_vector is not None:
                    features.append(feature_vector)
                    labels.append(item.get('pattern_type', 'unknown'))

            if len(features) < 20:
                return {
                    'success': False,
                    'error': 'Insufficient data for pattern analysis'
                }

            features_array = np.array(features)
            features_reshaped = features_array.reshape(features_array.shape[0], features_array.shape[1], 1)

            # Encode labels
            encoder = LabelEncoder()
            labels_encoded = encoder.fit_transform(labels)
            labels_cat = keras.utils.to_categorical(labels_encoded)

            # Train pattern recognizer if not trained
            if 'pattern_recognizer' not in self.models:
                history = self.pattern_recognizer.fit(
                    features_reshaped, labels_cat,
                    epochs=30,
                    batch_size=16,
                    validation_split=0.2,
                    verbose=0
                )
                self.models['pattern_recognizer'] = True
                self.encoders['pattern_recognizer'] = encoder

            # Predict patterns
            predictions = self.pattern_recognizer.predict(features_reshaped, verbose=0)

            # Analyze results
            pattern_analysis = {}
            for i, pred in enumerate(predictions):
                predicted_idx = np.argmax(pred)
                confidence = float(pred[predicted_idx])

                pattern_type = 'unknown'
                if encoder:
                    try:
                        pattern_type = encoder.inverse_transform([predicted_idx])[0]
                    except:
                        pass

                if pattern_type not in pattern_analysis:
                    pattern_analysis[pattern_type] = {
                        'count': 0,
                        'total_confidence': 0,
                        'samples': []
                    }

                pattern_analysis[pattern_type]['count'] += 1
                pattern_analysis[pattern_type]['total_confidence'] += confidence
                pattern_analysis[pattern_type]['samples'].append({
                    'index': i,
                    'confidence': confidence,
                    'original_data': pattern_data[i]
                })

            # Calculate averages
            for pattern_type, data in pattern_analysis.items():
                data['average_confidence'] = data['total_confidence'] / data['count']
                del data['total_confidence']

            return {
                'success': True,
                'patterns_detected': len(pattern_analysis),
                'pattern_analysis': pattern_analysis,
                'total_samples': len(features)
            }

        except Exception as e:
            logger.error(f"Error in pattern analysis: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def analyze_temporal_sequences(self, sequence_data: List[List[Dict[str, Any]]]) -> Dict[str, Any]:
        """
        Analyze temporal sequences using LSTM

        Args:
            sequence_data: List of temporal sequences

        Returns:
            Temporal analysis results
        """
        try:
            # Prepare sequence data
            sequences = []
            labels = []

            for sequence in sequence_data:
                if len(sequence) >= 10:  # Minimum sequence length
                    seq_features = []
                    for item in sequence[:10]:  # Take first 10 items
                        features = self._extract_temporal_features(item)
                        if features:
                            seq_features.append(features)

                    if len(seq_features) == 10:
                        sequences.append(seq_features)
                        # Determine sequence type based on pattern
                        seq_type = self._classify_sequence_type(sequence)
                        labels.append(seq_type)

            if len(sequences) < 5:
                return {
                    'success': False,
                    'error': 'Insufficient sequence data for temporal analysis'
                }

            sequences_array = np.array(sequences)

            # Encode labels
            encoder = LabelEncoder()
            labels_encoded = encoder.fit_transform(labels)
            labels_cat = keras.utils.to_categorical(labels_encoded)

            # Train temporal analyzer if not trained
            if 'temporal_analyzer' not in self.models:
                history = self.temporal_analyzer.fit(
                    sequences_array, labels_cat,
                    epochs=25,
                    batch_size=8,
                    validation_split=0.2,
                    verbose=0
                )
                self.models['temporal_analyzer'] = True
                self.encoders['temporal_analyzer'] = encoder

            # Predict temporal patterns
            predictions = self.temporal_analyzer.predict(sequences_array, verbose=0)

            temporal_patterns = {}
            for i, pred in enumerate(predictions):
                predicted_idx = np.argmax(pred)
                confidence = float(pred[predicted_idx])

                pattern_type = 'unknown'
                if encoder:
                    try:
                        pattern_type = encoder.inverse_transform([predicted_idx])[0]
                    except:
                        pass

                if pattern_type not in temporal_patterns:
                    temporal_patterns[pattern_type] = {
                        'count': 0,
                        'total_confidence': 0,
                        'sequences': []
                    }

                temporal_patterns[pattern_type]['count'] += 1
                temporal_patterns[pattern_type]['total_confidence'] += confidence
                temporal_patterns[pattern_type]['sequences'].append({
                    'index': i,
                    'confidence': confidence,
                    'sequence_length': len(sequence_data[i])
                })

            # Calculate averages
            for pattern_type, data in temporal_patterns.items():
                data['average_confidence'] = data['total_confidence'] / data['count']
                del data['total_confidence']

            return {
                'success': True,
                'temporal_patterns': len(temporal_patterns),
                'pattern_analysis': temporal_patterns,
                'total_sequences': len(sequences)
            }

        except Exception as e:
            logger.error(f"Error in temporal sequence analysis: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _extract_evidence_features(self, data: List[Dict[str, Any]]) -> Tuple[np.ndarray, List[str]]:
        """Extract features from evidence data for classification"""
        features = []
        labels = []

        for item in data:
            feature_vector = self._extract_single_evidence_features(item)
            if feature_vector is not None:
                features.append(feature_vector)
                labels.append(item.get('evidence_type', 'unknown'))

        return np.array(features), labels

    def _extract_single_evidence_features(self, evidence: Dict[str, Any]) -> Optional[np.ndarray]:
        """Extract features from a single evidence item"""
        try:
            features = []

            # Basic features
            features.append(len(str(evidence.get('content', ''))) / 1000)  # Content length
            features.append(len(str(evidence.get('metadata', ''))) / 500)  # Metadata length

            # File type features (simplified)
            file_type = evidence.get('file_type', 'unknown')
            file_types = ['pdf', 'doc', 'docx', 'txt', 'xml', 'json', 'jpg', 'png', 'mp4', 'unknown']
            for ft in file_types:
                features.append(1.0 if file_type == ft else 0.0)

            # Time-based features
            timestamp = evidence.get('timestamp')
            if timestamp:
                try:
                    dt = pd.to_datetime(timestamp)
                    features.append(dt.hour / 24.0)  # Hour of day
                    features.append(dt.weekday() / 7.0)  # Day of week
                except:
                    features.extend([0.5, 0.5])  # Default values
            else:
                features.extend([0.5, 0.5])

            # Communication features
            features.append(1.0 if evidence.get('has_phone', False) else 0.0)
            features.append(1.0 if evidence.get('has_email', False) else 0.0)
            features.append(len(evidence.get('contacts', [])) / 10.0)  # Contact count

            # Ensure we have exactly 100 features
            while len(features) < 100:
                features.append(0.0)

            return np.array(features[:100])

        except Exception as e:
            logger.error(f"Error extracting evidence features: {e}")
            return None

    def _extract_anomaly_features(self, data: Dict[str, Any]) -> Optional[List[float]]:
        """Extract features for anomaly detection"""
        try:
            features = []

            # Numerical features
            features.append(float(data.get('frequency', 0)) / 100.0)
            features.append(float(data.get('duration', 0)) / 3600.0)  # Convert to hours
            features.append(float(data.get('size', 0)) / 1000000.0)  # Convert to MB

            # Categorical features (one-hot encoded)
            categories = ['communication', 'file', 'device', 'location', 'unknown']
            category = data.get('category', 'unknown')
            for cat in categories:
                features.append(1.0 if category == cat else 0.0)

            # Ensure 100 features
            while len(features) < 100:
                features.append(0.0)

            return features[:100]

        except Exception as e:
            return None

    def _extract_pattern_features(self, data: Dict[str, Any]) -> Optional[List[float]]:
        """Extract features for pattern recognition"""
        try:
            features = []

            # Pattern-specific features
            pattern_data = data.get('pattern_data', [])
            if isinstance(pattern_data, list):
                # Statistical features
                if pattern_data:
                    features.append(np.mean(pattern_data))
                    features.append(np.std(pattern_data))
                    features.append(np.min(pattern_data))
                    features.append(np.max(pattern_data))
                    features.append(len(pattern_data))
                else:
                    features.extend([0.0, 0.0, 0.0, 0.0, 0.0])

            # Pattern type indicators
            pattern_types = ['temporal', 'spatial', 'frequency', 'behavioral', 'unknown']
            pattern_type = data.get('pattern_type', 'unknown')
            for pt in pattern_types:
                features.append(1.0 if pattern_type == pt else 0.0)

            # Ensure 100 features
            while len(features) < 100:
                features.append(0.0)

            return features[:100]

        except Exception as e:
            return None

    def _extract_temporal_features(self, data: Dict[str, Any]) -> Optional[List[float]]:
        """Extract features for temporal analysis"""
        try:
            features = []

            # Time-based features
            timestamp = data.get('timestamp')
            if timestamp:
                try:
                    dt = pd.to_datetime(timestamp)
                    features.append(dt.hour / 24.0)
                    features.append(dt.minute / 60.0)
                    features.append(dt.weekday() / 7.0)
                    features.append(dt.month / 12.0)
                except:
                    features.extend([0.5, 0.5, 0.5, 0.5])
            else:
                features.extend([0.5, 0.5, 0.5, 0.5])

            # Activity features
            features.append(float(data.get('activity_level', 0)) / 10.0)
            features.append(float(data.get('interaction_count', 0)) / 50.0)

            # Ensure 20 features per timestep
            while len(features) < 20:
                features.append(0.0)

            return features[:20]

        except Exception as e:
            return None

    def _classify_sequence_type(self, sequence: List[Dict[str, Any]]) -> str:
        """Classify the type of temporal sequence"""
        try:
            # Simple heuristic-based classification
            activity_levels = [item.get('activity_level', 0) for item in sequence]

            if not activity_levels:
                return 'unknown'

            mean_activity = np.mean(activity_levels)
            std_activity = np.std(activity_levels)

            # Classify based on patterns
            if std_activity > mean_activity * 0.5:
                return 'bursty'  # High variability
            elif mean_activity > 5:
                return 'active'  # Consistently high activity
            else:
                return 'steady'  # Steady low activity

        except Exception as e:
            return 'unknown'

    async def get_model_status(self) -> Dict[str, Any]:
        """Get status of all deep learning models"""
        return {
            'models': list(self.models.keys()),
            'total_models': len(self.models),
            'trained_models': len([m for m in self.models.values() if m is True]),
            'available_architectures': [
                'evidence_classifier',
                'anomaly_detector',
                'pattern_recognizer',
                'temporal_analyzer'
            ]
        }

    async def save_models(self, base_path: str = './models'):
        """Save trained models to disk"""
        try:
            import os
            os.makedirs(base_path, exist_ok=True)

            saved_models = []
            for model_name, model in self.models.items():
                if model is True and hasattr(self, model_name):
                    model_obj = getattr(self, model_name)
                    if hasattr(model_obj, 'save'):
                        path = f"{base_path}/{model_name}"
                        model_obj.save(path)
                        saved_models.append(model_name)

            return {
                'success': True,
                'saved_models': saved_models,
                'path': base_path
            }

        except Exception as e:
            logger.error(f"Error saving models: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def load_models(self, base_path: str = './models'):
        """Load trained models from disk"""
        try:
            import os

            loaded_models = []
            for model_name in ['evidence_classifier', 'anomaly_detector', 'pattern_recognizer', 'temporal_analyzer']:
                path = f"{base_path}/{model_name}"
                if os.path.exists(path):
                    if model_name == 'evidence_classifier':
                        self.evidence_classifier = keras.models.load_model(path)
                    elif model_name == 'anomaly_detector':
                        self.anomaly_detector = keras.models.load_model(path)
                    elif model_name == 'pattern_recognizer':
                        self.pattern_recognizer = keras.models.load_model(path)
                    elif model_name == 'temporal_analyzer':
                        self.temporal_analyzer = keras.models.load_model(path)

                    self.models[model_name] = True
                    loaded_models.append(model_name)

            return {
                'success': True,
                'loaded_models': loaded_models,
                'path': base_path
            }

        except Exception as e:
            logger.error(f"Error loading models: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Global instance
deep_learning_analyzer = DeepLearningEvidenceAnalyzer()
