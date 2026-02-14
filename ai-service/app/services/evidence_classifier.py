import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support
from sklearn.cluster import KMeans
import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple
import re
import json
from datetime import datetime
from collections import Counter

logger = logging.getLogger(__name__)

class EvidenceClassifier:
    """
    ML-based evidence classification system with multiple algorithms
    """

    def __init__(self):
        self.classifiers = {}
        self.vectorizers = {}
        self.encoders = {}
        self.scalers = {}
        self.is_trained = False
        self.evidence_categories = [
            'communication', 'document', 'image', 'video', 'audio',
            'device_data', 'network_log', 'system_file', 'archive', 'unknown'
        ]

    async def train_classifier(self, training_data: List[Dict[str, Any]],
                             algorithm: str = 'ensemble') -> Dict[str, Any]:
        """
        Train the evidence classification model

        Args:
            training_data: List of evidence samples with features and labels
            algorithm: Algorithm to use ('rf', 'gb', 'svm', 'nb', 'ensemble')

        Returns:
            Training results and metrics
        """
        try:
            logger.info(f"Training evidence classifier with {len(training_data)} samples using {algorithm}")

            if len(training_data) < 20:
                return {
                    'success': False,
                    'error': 'Insufficient training data. Minimum 20 samples required.'
                }

            # Prepare features and labels
            X_text, X_numeric, y = self._prepare_training_data(training_data)

            if len(X_text) == 0 or len(y) == 0:
                return {
                    'success': False,
                    'error': 'No valid training data prepared'
                }

            # Text feature extraction
            text_vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2)
            )
            X_text_features = text_vectorizer.fit_transform(X_text)

            # Numeric feature scaling
            if X_numeric.shape[1] > 0:
                numeric_scaler = StandardScaler()
                X_numeric_scaled = numeric_scaler.fit_transform(X_numeric)
                X_combined = np.hstack([X_text_features.toarray(), X_numeric_scaled])
            else:
                X_combined = X_text_features.toarray()

            # Label encoding
            label_encoder = LabelEncoder()
            y_encoded = label_encoder.fit_transform(y)

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X_combined, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
            )

            # Train classifier based on algorithm
            if algorithm == 'rf':
                classifier = RandomForestClassifier(
                    n_estimators=100,
                    max_depth=10,
                    random_state=42
                )
            elif algorithm == 'gb':
                classifier = GradientBoostingClassifier(
                    n_estimators=100,
                    learning_rate=0.1,
                    max_depth=5,
                    random_state=42
                )
            elif algorithm == 'svm':
                classifier = SVC(
                    kernel='rbf',
                    C=1.0,
                    probability=True,
                    random_state=42
                )
            elif algorithm == 'nb':
                # For Naive Bayes, use raw counts instead of TF-IDF
                count_vectorizer = CountVectorizer(
                    max_features=1000,
                    stop_words='english'
                )
                X_text_counts = count_vectorizer.fit_transform(X_text)
                if X_numeric.shape[1] > 0:
                    X_combined_nb = np.hstack([X_text_counts.toarray(), X_numeric])
                else:
                    X_combined_nb = X_text_counts.toarray()

                X_train_nb, X_test_nb = train_test_split(
                    X_combined_nb, test_size=0.2, random_state=42, stratify=y_encoded
                )[0:2]

                classifier = MultinomialNB()
                text_vectorizer = count_vectorizer
                X_train, X_test = X_train_nb, X_test_nb
            elif algorithm == 'ensemble':
                # Create ensemble classifier
                rf = RandomForestClassifier(n_estimators=50, random_state=42)
                gb = GradientBoostingClassifier(n_estimators=50, random_state=42)
                svm = SVC(kernel='rbf', C=1.0, probability=True, random_state=42)

                classifier = VotingClassifier(
                    estimators=[('rf', rf), ('gb', gb), ('svm', svm)],
                    voting='soft'
                )
            else:
                return {
                    'success': False,
                    'error': f'Unknown algorithm: {algorithm}'
                }

            # Train the classifier
            classifier.fit(X_train, y_train)

            # Evaluate
            y_pred = classifier.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)

            # Cross-validation
            cv_scores = cross_val_score(classifier, X_combined, y_encoded, cv=5)

            # Detailed metrics
            precision, recall, f1, support = precision_recall_fscore_support(
                y_test, y_pred, average='weighted'
            )

            # Store trained components
            self.classifiers[algorithm] = classifier
            self.vectorizers[algorithm] = text_vectorizer
            if 'numeric_scaler' in locals():
                self.scalers[algorithm] = numeric_scaler
            self.encoders[algorithm] = label_encoder

            return {
                'success': True,
                'algorithm': algorithm,
                'accuracy': float(accuracy),
                'precision': float(precision),
                'recall': float(recall),
                'f1_score': float(f1),
                'cv_mean': float(cv_scores.mean()),
                'cv_std': float(cv_scores.std()),
                'training_samples': len(X_train),
                'test_samples': len(X_test),
                'categories': label_encoder.classes_.tolist()
            }

        except Exception as e:
            logger.error(f"Error training classifier: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def classify_evidence(self, evidence_data: Dict[str, Any],
                              algorithm: str = 'ensemble') -> Dict[str, Any]:
        """
        Classify evidence using trained ML model

        Args:
            evidence_data: Evidence data to classify
            algorithm: Algorithm to use for classification

        Returns:
            Classification results with confidence scores
        """
        try:
            if algorithm not in self.classifiers:
                return {
                    'success': False,
                    'error': f'Classifier {algorithm} not trained'
                }

            # Prepare features
            features = self._prepare_single_evidence(evidence_data, algorithm)

            if features is None:
                return {
                    'success': False,
                    'error': 'Could not prepare features for classification'
                }

            # Classify
            classifier = self.classifiers[algorithm]
            predictions = classifier.predict_proba([features])[0]

            # Get top predictions
            top_indices = np.argsort(predictions)[-3:][::-1]
            encoder = self.encoders[algorithm]

            top_predictions = []
            for idx in top_indices:
                confidence = float(predictions[idx])
                category = 'unknown'
                if encoder and idx < len(encoder.classes_):
                    category = encoder.classes_[idx]

                top_predictions.append({
                    'category': category,
                    'confidence': confidence
                })

            predicted_category = top_predictions[0]['category']
            confidence = top_predictions[0]['confidence']

            return {
                'success': True,
                'predicted_category': predicted_category,
                'confidence': confidence,
                'top_predictions': top_predictions,
                'all_probabilities': predictions.tolist(),
                'algorithm': algorithm
            }

        except Exception as e:
            logger.error(f"Error classifying evidence: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def batch_classify(self, evidence_list: List[Dict[str, Any]],
                           algorithm: str = 'ensemble') -> Dict[str, Any]:
        """
        Classify multiple evidence items in batch

        Args:
            evidence_list: List of evidence data to classify
            algorithm: Algorithm to use

        Returns:
            Batch classification results
        """
        try:
            if algorithm not in self.classifiers:
                return {
                    'success': False,
                    'error': f'Classifier {algorithm} not trained'
                }

            results = []
            successful = 0
            failed = 0

            for i, evidence in enumerate(evidence_list):
                result = await self.classify_evidence(evidence, algorithm)
                if result['success']:
                    successful += 1
                    results.append({
                        'index': i,
                        'evidence_id': evidence.get('id'),
                        'classification': result
                    })
                else:
                    failed += 1
                    results.append({
                        'index': i,
                        'evidence_id': evidence.get('id'),
                        'error': result.get('error', 'Classification failed')
                    })

            return {
                'success': True,
                'total': len(evidence_list),
                'successful': successful,
                'failed': failed,
                'results': results,
                'algorithm': algorithm
            }

        except Exception as e:
            logger.error(f"Error in batch classification: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def cluster_evidence(self, evidence_list: List[Dict[str, Any]],
                             n_clusters: int = 5) -> Dict[str, Any]:
        """
        Cluster evidence using unsupervised learning

        Args:
            evidence_list: List of evidence to cluster
            n_clusters: Number of clusters to create

        Returns:
            Clustering results
        """
        try:
            if len(evidence_list) < n_clusters:
                return {
                    'success': False,
                    'error': f'Insufficient data for {n_clusters} clusters'
                }

            # Prepare features
            X_text, X_numeric, _ = self._prepare_training_data(evidence_list)

            if len(X_text) == 0:
                return {
                    'success': False,
                    'error': 'No valid features extracted'
                }

            # Text feature extraction
            vectorizer = TfidfVectorizer(
                max_features=500,
                stop_words='english'
            )
            X_text_features = vectorizer.fit_transform(X_text)

            # Combine features
            if X_numeric.shape[1] > 0:
                scaler = StandardScaler()
                X_numeric_scaled = scaler.fit_transform(X_numeric)
                X_combined = np.hstack([X_text_features.toarray(), X_numeric_scaled])
            else:
                X_combined = X_text_features.toarray()

            # Perform clustering
            kmeans = KMeans(
                n_clusters=n_clusters,
                random_state=42,
                n_init=10
            )
            cluster_labels = kmeans.fit_predict(X_combined)

            # Analyze clusters
            cluster_analysis = {}
            for i in range(n_clusters):
                cluster_indices = np.where(cluster_labels == i)[0]
                cluster_evidence = [evidence_list[idx] for idx in cluster_indices]

                # Calculate cluster characteristics
                categories = [ev.get('evidence_type', 'unknown') for ev in cluster_evidence]
                category_counts = Counter(categories)
                most_common_category = category_counts.most_common(1)[0][0]

                cluster_analysis[f'cluster_{i}'] = {
                    'size': len(cluster_indices),
                    'most_common_category': most_common_category,
                    'category_distribution': dict(category_counts),
                    'evidence_indices': cluster_indices.tolist(),
                    'centroid': kmeans.cluster_centers_[i][:10].tolist()  # First 10 dimensions
                }

            return {
                'success': True,
                'n_clusters': n_clusters,
                'total_samples': len(evidence_list),
                'cluster_analysis': cluster_analysis,
                'silhouette_score': self._calculate_silhouette_score(X_combined, cluster_labels),
                'inertia': float(kmeans.inertia_)
            }

        except Exception as e:
            logger.error(f"Error in evidence clustering: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def optimize_hyperparameters(self, training_data: List[Dict[str, Any]],
                                     algorithm: str = 'rf') -> Dict[str, Any]:
        """
        Optimize hyperparameters for the classifier

        Args:
            training_data: Training data
            algorithm: Algorithm to optimize

        Returns:
            Optimization results
        """
        try:
            logger.info(f"Optimizing hyperparameters for {algorithm}")

            # Prepare data
            X_text, X_numeric, y = self._prepare_training_data(training_data)

            text_vectorizer = TfidfVectorizer(max_features=500, stop_words='english')
            X_text_features = text_vectorizer.fit_transform(X_text)

            if X_numeric.shape[1] > 0:
                scaler = StandardScaler()
                X_numeric_scaled = scaler.fit_transform(X_numeric)
                X_combined = np.hstack([X_text_features.toarray(), X_numeric_scaled])
            else:
                X_combined = X_text_features.toarray()

            label_encoder = LabelEncoder()
            y_encoded = label_encoder.fit_transform(y)

            # Define parameter grids
            if algorithm == 'rf':
                param_grid = {
                    'n_estimators': [50, 100, 200],
                    'max_depth': [None, 10, 20],
                    'min_samples_split': [2, 5, 10]
                }
                classifier = RandomForestClassifier(random_state=42)
            elif algorithm == 'svm':
                param_grid = {
                    'C': [0.1, 1, 10],
                    'kernel': ['rbf', 'linear'],
                    'gamma': ['scale', 'auto']
                }
                classifier = SVC(probability=True, random_state=42)
            else:
                return {
                    'success': False,
                    'error': f'Hyperparameter optimization not supported for {algorithm}'
                }

            # Grid search
            grid_search = GridSearchCV(
                classifier,
                param_grid,
                cv=3,
                scoring='accuracy',
                n_jobs=-1
            )

            grid_search.fit(X_combined, y_encoded)

            return {
                'success': True,
                'algorithm': algorithm,
                'best_parameters': grid_search.best_params_,
                'best_score': float(grid_search.best_score_),
                'cv_results': {
                    'mean_test_score': grid_search.cv_results_['mean_test_score'].tolist(),
                    'std_test_score': grid_search.cv_results_['std_test_score'].tolist()
                }
            }

        except Exception as e:
            logger.error(f"Error in hyperparameter optimization: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def get_classifier_stats(self) -> Dict[str, Any]:
        """Get statistics about trained classifiers"""
        return {
            'trained_classifiers': list(self.classifiers.keys()),
            'total_classifiers': len(self.classifiers),
            'available_algorithms': ['rf', 'gb', 'svm', 'nb', 'ensemble'],
            'evidence_categories': self.evidence_categories
        }

    def _prepare_training_data(self, data: List[Dict[str, Any]]) -> Tuple[List[str], np.ndarray, List[str]]:
        """Prepare training data for classification"""
        text_features = []
        numeric_features = []
        labels = []

        for item in data:
            # Extract text content
            text_content = self._extract_text_content(item)
            text_features.append(text_content)

            # Extract numeric features
            numeric_vector = self._extract_numeric_features(item)
            numeric_features.append(numeric_vector)

            # Get label
            label = item.get('evidence_type', 'unknown')
            labels.append(label)

        return text_features, np.array(numeric_features), labels

    def _prepare_single_evidence(self, evidence: Dict[str, Any], algorithm: str) -> Optional[np.ndarray]:
        """Prepare features for single evidence classification"""
        try:
            # Extract text content
            text_content = self._extract_text_content(evidence)
            text_vectorizer = self.vectorizers.get(algorithm)
            if not text_vectorizer:
                return None

            # Vectorize text
            text_features = text_vectorizer.transform([text_content])

            # Extract numeric features
            numeric_vector = self._extract_numeric_features(evidence)

            # Scale numeric features if scaler exists
            scaler = self.scalers.get(algorithm)
            if scaler and numeric_vector.shape[0] > 0:
                numeric_scaled = scaler.transform([numeric_vector])
                combined_features = np.hstack([text_features.toarray(), numeric_scaled])
            else:
                combined_features = text_features.toarray()

            return combined_features[0]

        except Exception as e:
            logger.error(f"Error preparing single evidence: {e}")
            return None

    def _extract_text_content(self, evidence: Dict[str, Any]) -> str:
        """Extract text content from evidence for classification"""
        text_parts = []

        # Content field
        if evidence.get('content'):
            text_parts.append(str(evidence['content']))

        # Metadata
        if evidence.get('metadata'):
            text_parts.append(str(evidence['metadata']))

        # File name
        if evidence.get('filename'):
            text_parts.append(str(evidence['filename']))

        # Description
        if evidence.get('description'):
            text_parts.append(str(evidence['description']))

        # Combine and clean
        combined_text = ' '.join(text_parts)
        # Remove special characters and extra whitespace
        combined_text = re.sub(r'[^\w\s]', ' ', combined_text)
        combined_text = ' '.join(combined_text.split())

        return combined_text.lower()

    def _extract_numeric_features(self, evidence: Dict[str, Any]) -> np.ndarray:
        """Extract numeric features from evidence"""
        features = []

        # File size
        features.append(float(evidence.get('size', 0)) / 1000000)  # MB

        # Timestamps (normalized)
        if evidence.get('created_at'):
            try:
                dt = pd.to_datetime(evidence['created_at'])
                features.append(dt.hour / 24.0)  # Hour of day
                features.append(dt.weekday() / 7.0)  # Day of week
                features.append(dt.month / 12.0)  # Month
            except:
                features.extend([0.5, 0.5, 0.5])
        else:
            features.extend([0.5, 0.5, 0.5])

        # Boolean features
        features.append(1.0 if evidence.get('has_attachments', False) else 0.0)
        features.append(1.0 if evidence.get('is_encrypted', False) else 0.0)
        features.append(1.0 if evidence.get('contains_text', False) else 0.0)

        # Count features
        features.append(len(evidence.get('contacts', [])) / 10.0)
        features.append(len(str(evidence.get('content', ''))) / 1000.0)

        return np.array(features)

    def _calculate_silhouette_score(self, X: np.ndarray, labels: np.ndarray) -> float:
        """Calculate silhouette score for clustering evaluation"""
        try:
            from sklearn.metrics import silhouette_score
            return float(silhouette_score(X, labels))
        except:
            return 0.0


# Global instance
evidence_classifier = EvidenceClassifier()
