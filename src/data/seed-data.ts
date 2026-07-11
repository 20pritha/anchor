import type {
  UserProfile,
  Person,
  Medication,
  Routine,
  Place,
  ObjectEntity,
  EpisodeNamespace,
  EpisodeSource,
} from "@/lib/types";
import { DEMO_USER_ID } from "@/lib/config";

export const SEED_USER: UserProfile = {
  id: DEMO_USER_ID,
  displayName: "Ravi",
  preferences: { language: "en", ttsSpeed: 1.0 },
};

export const SEED_PERSONS: Person[] = [
  { id: "person-1", name: "Priya", relationship: "daughter", notes: "Lives in the same city, visits most evenings" },
  { id: "person-2", name: "Mrs. Sharma", relationship: "neighbor", notes: "Next door, comes over for tea on weekdays" },
  { id: "person-3", name: "Dr. Rao", relationship: "doctor", notes: "Neurologist, appointment every 3 months" },
  { id: "person-4", name: "Arjun", relationship: "son", notes: "Lives abroad, video calls every Sunday evening" },
  { id: "person-5", name: "Dr. Iyer", relationship: "doctor", notes: "Cardiologist, appointment every 6 months" },
  { id: "person-6", name: "Meena", relationship: "home nurse", notes: "Visits on Tuesday and Thursday mornings for physiotherapy" },
  { id: "person-7", name: "Vijay", relationship: "friend", notes: "Old college friend, plays chess on weekends" },
  { id: "person-8", name: "Kabir", relationship: "grandson", notes: "Priya's son, visits on weekends" },
  { id: "person-9", name: "Lakshmi", relationship: "sister", notes: "Lives in another city, calls on Wednesdays" },
];

export const SEED_MEDICATIONS: Medication[] = [
  { id: "med-1", name: "Donepezil", dose: "5mg", schedule: ["08:00"], purpose: "for memory" },
  { id: "med-2", name: "Metformin", dose: "500mg", schedule: ["08:00", "20:00"], purpose: "for diabetes" },
  { id: "med-3", name: "Amlodipine", dose: "5mg", schedule: ["08:00"], purpose: "for blood pressure" },
  { id: "med-4", name: "Atorvastatin", dose: "10mg", schedule: ["20:00"], purpose: "for cholesterol" },
  { id: "med-5", name: "Aspirin", dose: "75mg", schedule: ["08:00"], purpose: "for heart health" },
];

export const SEED_ROUTINES: Routine[] = [
  { id: "routine-1", label: "Morning walk", timeOfDay: "07:00", recurrence: "daily" },
  { id: "routine-2", label: "Tea with neighbor", timeOfDay: "16:00", recurrence: "weekdays" },
  { id: "routine-3", label: "Physiotherapy with Meena", timeOfDay: "09:30", recurrence: "weekly", daysOfWeek: [2, 4] },
  { id: "routine-4", label: "Video call with Arjun", timeOfDay: "19:00", recurrence: "weekly", daysOfWeek: [7] },
  { id: "routine-5", label: "Yoga session", timeOfDay: "06:30", recurrence: "weekdays" },
  { id: "routine-6", label: "Call with Lakshmi", timeOfDay: "18:00", recurrence: "weekly", daysOfWeek: [3] },
];

export const SEED_PLACES: Place[] = [
  { id: "place-1", label: "Home", type: "residence" },
  { id: "place-2", label: "Dr. Rao's Clinic", type: "clinic" },
  { id: "place-3", label: "Park", type: "outdoor" },
  { id: "place-4", label: "Dr. Iyer's Clinic", type: "clinic" },
  { id: "place-5", label: "Community center", type: "recreation" },
  { id: "place-6", label: "Priya's house", type: "residence" },
];

export const SEED_OBJECTS: Array<ObjectEntity & { placeId: string }> = [
  { id: "obj-1", label: "House keys", usualLocation: "kitchen drawer", placeId: "place-1" },
  { id: "obj-2", label: "Blue umbrella", usualLocation: "hall stand", placeId: "place-1" },
  { id: "obj-3", label: "Reading glasses", usualLocation: "bedside table", placeId: "place-1" },
  { id: "obj-4", label: "Hearing aid", usualLocation: "bathroom shelf", placeId: "place-1" },
  { id: "obj-5", label: "Wallet", usualLocation: "study desk", placeId: "place-1" },
  { id: "obj-6", label: "Walking stick", usualLocation: "by the front door", placeId: "place-1" },
];

export interface SeedEpisode {
  text: string;
  entityRefs: string[];
  namespace: EpisodeNamespace;
  source: EpisodeSource;
  importance: number;
  /** Hours offset from "now" — negative is in the past. Used to compute a realistic timestamp at seed time. */
  hoursAgo: number;
}

export const SEED_EPISODES: SeedEpisode[] = [
  // --- Today ---
  {
    text: "Took morning pills at 08:15 with breakfast: Donepezil, Metformin, Amlodipine, and Aspirin",
    entityRefs: ["med-1", "med-2", "med-3", "med-5"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.7,
    hoursAgo: 3,
  },
  {
    text: "Priya called at 10:00 to check in and remind about the clinic visit next week",
    entityRefs: ["person-1", "place-2"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.5,
    hoursAgo: 1,
  },
  {
    text: "Placed keys on the kitchen counter after coming back from the morning walk",
    entityRefs: ["obj-1", "place-1"],
    namespace: "episodic/objects",
    source: "caregiver_seed",
    importance: 0.4,
    hoursAgo: 4.5,
  },
  {
    text: "Went for the usual morning walk in the park, felt good and sunny",
    entityRefs: ["routine-1", "place-3"],
    namespace: "episodic/daily",
    source: "caregiver_seed",
    importance: 0.3,
    hoursAgo: 4.8,
  },
  {
    text: "Put reading glasses on the bedside table before the afternoon nap",
    entityRefs: ["obj-3", "place-1"],
    namespace: "episodic/objects",
    source: "caregiver_seed",
    importance: 0.2,
    hoursAgo: 6,
  },
  {
    text: "Meena came over for the Tuesday physiotherapy session, worked on knee exercises",
    entityRefs: ["person-6", "routine-3"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.5,
    hoursAgo: 5.5,
  },
  {
    text: "Left the wallet on the study desk after paying the milkman",
    entityRefs: ["obj-5", "place-1"],
    namespace: "episodic/objects",
    source: "caregiver_seed",
    importance: 0.3,
    hoursAgo: 7,
  },

  // --- Yesterday ---
  {
    text: "Mrs. Sharma came over for tea at 16:00 yesterday and they talked about the neighborhood garden",
    entityRefs: ["person-2"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.6,
    hoursAgo: 22,
  },
  {
    text: "Took evening dose of Metformin and Atorvastatin at 20:05 yesterday",
    entityRefs: ["med-2", "med-4"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.6,
    hoursAgo: 15,
  },
  {
    text: "Left the blue umbrella by the hall stand before yesterday's rain",
    entityRefs: ["obj-2", "place-1"],
    namespace: "episodic/objects",
    source: "caregiver_seed",
    importance: 0.3,
    hoursAgo: 30,
  },
  {
    text: "Dr. Rao's clinic called to confirm the neurologist appointment next week",
    entityRefs: ["person-3", "place-2"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.5,
    hoursAgo: 20,
  },
  {
    text: "Took morning pills at 08:10 yesterday with breakfast, all five as usual",
    entityRefs: ["med-1", "med-2", "med-3", "med-4", "med-5"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.6,
    hoursAgo: 27,
  },
  {
    text: "Priya visited in the evening and stayed for dinner, brought Kabir along",
    entityRefs: ["person-1", "person-8"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.7,
    hoursAgo: 26,
  },
  {
    text: "Had a video call with Arjun in the evening, he mentioned visiting next month",
    entityRefs: ["person-4", "routine-4"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.6,
    hoursAgo: 29,
  },
  {
    text: "Did the morning yoga session before breakfast, felt more energetic than usual",
    entityRefs: ["routine-5"],
    namespace: "episodic/daily",
    source: "caregiver_seed",
    importance: 0.3,
    hoursAgo: 31,
  },
  {
    text: "Hearing aid battery was replaced and left on the bathroom shelf",
    entityRefs: ["obj-4", "place-1"],
    namespace: "episodic/objects",
    source: "caregiver_seed",
    importance: 0.3,
    hoursAgo: 25,
  },

  // --- 2 days ago ---
  {
    text: "Had tea and a short chat with Mrs. Sharma over the fence about her grandchildren",
    entityRefs: ["person-2"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.3,
    hoursAgo: 46,
  },
  {
    text: "Vijay came over on Saturday afternoon for a game of chess, Ravi won two out of three",
    entityRefs: ["person-7"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.4,
    hoursAgo: 50,
  },
  {
    text: "Took morning pills at 08:20, two days ago, with breakfast",
    entityRefs: ["med-1", "med-2", "med-3", "med-5"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.5,
    hoursAgo: 51,
  },
  {
    text: "Walking stick was left by the front door after the trip to the community center",
    entityRefs: ["obj-6", "place-5"],
    namespace: "episodic/objects",
    source: "caregiver_seed",
    importance: 0.3,
    hoursAgo: 53,
  },
  {
    text: "Attended a music evening at the community center, enjoyed the old Hindi film songs",
    entityRefs: ["place-5"],
    namespace: "episodic/daily",
    source: "caregiver_seed",
    importance: 0.4,
    hoursAgo: 55,
  },

  // --- 3 days ago ---
  {
    text: "Lakshmi called on Wednesday evening, they talked for almost an hour about old times",
    entityRefs: ["person-9", "routine-6"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.5,
    hoursAgo: 70,
  },
  {
    text: "Meena came for the Thursday physiotherapy session, focused on balance exercises",
    entityRefs: ["person-6", "routine-3"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.4,
    hoursAgo: 76,
  },
  {
    text: "Took evening medication a little late, around 21:00, after a longer nap than usual",
    entityRefs: ["med-2", "med-4"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.5,
    hoursAgo: 63,
  },
  {
    text: "Reading glasses were found in the living room instead of the bedside table",
    entityRefs: ["obj-3", "place-1"],
    namespace: "episodic/objects",
    source: "caregiver_seed",
    importance: 0.2,
    hoursAgo: 68,
  },

  // --- Last week ---
  {
    text: "Visited Dr. Iyer's clinic for the six-month cardiology check-up, blood pressure was normal",
    entityRefs: ["person-5", "place-4"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.8,
    hoursAgo: 96,
  },
  {
    text: "Dr. Iyer adjusted the Amlodipine dose slightly and asked to monitor blood pressure weekly",
    entityRefs: ["med-3", "person-5"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.7,
    hoursAgo: 96,
  },
  {
    text: "Priya helped set up a pill organizer for the week during her Sunday visit",
    entityRefs: ["person-1"],
    namespace: "episodic/daily",
    source: "caregiver_seed",
    importance: 0.5,
    hoursAgo: 100,
  },
  {
    text: "Kabir visited over the weekend and they fed the ducks at the park together",
    entityRefs: ["person-8", "place-3"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.6,
    hoursAgo: 110,
  },
  {
    text: "House keys were misplaced for a while before being found in the coat pocket",
    entityRefs: ["obj-1"],
    namespace: "episodic/objects",
    source: "caregiver_seed",
    importance: 0.4,
    hoursAgo: 120,
  },
  {
    text: "Skipped the morning walk due to light rain, did light stretching indoors instead",
    entityRefs: ["routine-1"],
    namespace: "episodic/daily",
    source: "caregiver_seed",
    importance: 0.2,
    hoursAgo: 140,
  },
  {
    text: "Dr. Rao's clinic visit went well, cognitive assessment score stable compared to last quarter",
    entityRefs: ["person-3", "place-2"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.8,
    hoursAgo: 160,
  },
];
