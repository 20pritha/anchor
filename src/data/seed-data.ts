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
  { id: "person-1", name: "Priya", relationship: "daughter", notes: "Lives in the same city" },
  { id: "person-2", name: "Mrs. Sharma", relationship: "neighbor", notes: "Next door" },
  { id: "person-3", name: "Dr. Rao", relationship: "doctor", notes: "Neurologist, appointment every 3 months" },
];

export const SEED_MEDICATIONS: Medication[] = [
  { id: "med-1", name: "Donepezil", dose: "5mg", schedule: ["08:00"], purpose: "for memory" },
  { id: "med-2", name: "Metformin", dose: "500mg", schedule: ["08:00", "20:00"], purpose: "for diabetes" },
];

export const SEED_ROUTINES: Routine[] = [
  { id: "routine-1", label: "Morning walk", timeOfDay: "07:00", recurrence: "daily" },
  { id: "routine-2", label: "Tea with neighbor", timeOfDay: "16:00", recurrence: "weekdays" },
];

export const SEED_PLACES: Place[] = [
  { id: "place-1", label: "Home", type: "residence" },
  { id: "place-2", label: "Dr. Rao's Clinic", type: "clinic" },
  { id: "place-3", label: "Park", type: "outdoor" },
];

export const SEED_OBJECTS: Array<ObjectEntity & { placeId: string }> = [
  { id: "obj-1", label: "House keys", usualLocation: "kitchen drawer", placeId: "place-1" },
  { id: "obj-2", label: "Blue umbrella", usualLocation: "hall stand", placeId: "place-1" },
  { id: "obj-3", label: "Reading glasses", usualLocation: "bedside table", placeId: "place-1" },
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
  {
    text: "Took morning pills at 08:15 with breakfast",
    entityRefs: ["med-1", "med-2"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.7,
    hoursAgo: 3,
  },
  {
    text: "Priya called at 10:00 to check in",
    entityRefs: ["person-1"],
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
    text: "Mrs. Sharma came over for tea at 16:00 yesterday",
    entityRefs: ["person-2"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.6,
    hoursAgo: 22,
  },
  {
    text: "Took evening dose of Metformin at 20:05 yesterday",
    entityRefs: ["med-2"],
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
    text: "Dr. Rao's clinic called to confirm the appointment next week",
    entityRefs: ["person-3", "place-2"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.5,
    hoursAgo: 20,
  },
  {
    text: "Went for the usual morning walk in the park",
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
    text: "Took morning pills at 08:10 yesterday with breakfast",
    entityRefs: ["med-1", "med-2"],
    namespace: "episodic/medical",
    source: "caregiver_seed",
    importance: 0.6,
    hoursAgo: 27,
  },
  {
    text: "Priya visited in the evening and stayed for dinner",
    entityRefs: ["person-1"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.7,
    hoursAgo: 26,
  },
  {
    text: "Had tea and a short chat with Mrs. Sharma over the fence",
    entityRefs: ["person-2"],
    namespace: "episodic/people",
    source: "caregiver_seed",
    importance: 0.3,
    hoursAgo: 46,
  },
];
