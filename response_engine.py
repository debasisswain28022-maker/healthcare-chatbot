import json
from nlp import preprocess, contains_keyword
from collections import defaultdict


class ResponseEngine:
    def __init__(self, kb_path="knowledge_base.json", symptom_path="symptom.json"):
        # Load knowledge base
        with open(kb_path, "r", encoding="utf-8") as f:
            self.kb = json.load(f)

        # Load symptom data
        with open(symptom_path, "r", encoding="utf-8") as f:
            self.symptom_data = json.load(f)

        # Normalize keywords (lowercase)
        for entry in self.kb.get("entries", []):
            entry["keywords"] = [kw.lower() for kw in entry.get("keywords", [])]

        # Process symptom data: group symptoms by disease
        self.disease_symptoms = defaultdict(set)
        for entry in self.symptom_data:
            disease = entry["disease"]
            symptoms = [s.lower().replace(" ", "_") for s in entry["symptoms"]]
            self.disease_symptoms[disease].update(symptoms)

    def diagnose_symptoms(self, user_text, top_n: int = 3):
        """Return a list of possible diseases based on symptoms mentioned in user_text.

        Returns a list of dicts, each containing:
            - disease
            - match_ratio (0-1)
            - match_count
            - total_symptoms
        """
        text = preprocess(user_text)
        all_symptoms = set()
        for symptoms in self.disease_symptoms.values():
            all_symptoms.update(symptoms)

        mentioned_symptoms = set()
        for symptom in all_symptoms:
            if contains_keyword(text, symptom.replace("_", " ")):
                mentioned_symptoms.add(symptom)

        possible_diseases = []
        for disease, symptoms in self.disease_symptoms.items():
            matched = mentioned_symptoms & symptoms
            if not matched:
                continue
            match_count = len(matched)
            total = len(symptoms)
            match_ratio = match_count / total if total else 0
            possible_diseases.append({
                "disease": disease,
                "match_ratio": match_ratio,
                "match_count": match_count,
                "total_symptoms": total,
            })

        # Sort by match ratio desc, then by match count desc
        possible_diseases.sort(key=lambda x: (x["match_ratio"], x["match_count"]), reverse=True)

        return possible_diseases[:top_n]

    def format_diagnosis(self, diagnoses):
        if not diagnoses:
            return None

        diseases = [d["disease"] for d in diagnoses][:3]
        disease_list = ", ".join(diseases)

        msg = [
            f"Based on your symptoms, the most likely conditions could be: {disease_list}.",
            "",
            "What you can do now:",
            "1. Rest and stay hydrated.",
            "2. Avoid self-medication and over-the-counter drugs unless advised by a doctor.",
            "3. Monitor any changes in symptoms (fever, breathing, pain, rash, etc.).",
            "4. Seek medical advice for a proper diagnosis and treatment plan.",
            "",
            "⚠️ Seek immediate medical care if you experience: difficulty breathing, chest pain, severe bleeding, confusion, or loss of consciousness.",
        ]

        return "\n".join(msg)

    def get_response(self, user_text):
        # Preprocess user input
        text = preprocess(user_text)

        # 1. Emergency check FIRST (highest priority)
        for entry in self.kb.get("entries", []):
            if entry.get("priority") == "high":
                for kw in entry["keywords"]:
                    if contains_keyword(text, kw):
                        return entry["response"]

        # 2. Normal matching (score-based)
        best_entry = None
        best_score = 0

        for entry in self.kb.get("entries", []):
            score = 0
            for kw in entry["keywords"]:
                if contains_keyword(text, kw):
                    # Phrase keywords get higher weight
                    score += 2 if " " in kw else 1

            if score > best_score:
                best_score = score
                best_entry = entry

        # 3. Return best match
        if best_entry:
            return best_entry["response"]

        # 4. Try symptom diagnosis
        diagnoses = self.diagnose_symptoms(user_text)
        formatted = self.format_diagnosis(diagnoses)
        if formatted:
            return formatted

        # 5. Fallback response
        return self.kb.get(
            "fallback",
            "I'm sorry, I do not have enough information. Please consult a medical professional."
        )
