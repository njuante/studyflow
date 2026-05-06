use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub created_at: String,
    pub sort_order: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StudyEventType {
    Theory,
    Practice,
    Review,
    Exam,
}

impl StudyEventType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Theory => "theory",
            Self::Practice => "practice",
            Self::Review => "review",
            Self::Exam => "exam",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "theory" => Some(Self::Theory),
            "practice" => Some(Self::Practice),
            "review" => Some(Self::Review),
            "exam" => Some(Self::Exam),
            _ => None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StudyPriority {
    Low,
    Medium,
    High,
}

impl StudyPriority {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "low" => Some(Self::Low),
            "medium" => Some(Self::Medium),
            "high" => Some(Self::High),
            _ => None,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StudyEvent {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub date: String,
    pub start_time: String,
    pub duration_minutes: i64,
    pub tag_id: Option<String>,
    #[serde(rename = "type")]
    pub event_type: StudyEventType,
    pub priority: StudyPriority,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default = "default_true")]
    pub scheduled: bool,
    #[serde(default)]
    pub completed: bool,
    #[serde(default)]
    pub completed_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ImportedPlanning {
    pub events: Vec<StudyEvent>,
    pub warnings: Vec<String>,
}
