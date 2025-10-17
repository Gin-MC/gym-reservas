export interface Class {
  id: string;
  name: string;
  description: string;
  instructor: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalSpots: number;
  reservedSpots: number;
  availableSpots: number;
  status: 'active' | 'full' | 'cancelled';
  icon: string; // emoji: 🧘, 🚴, 💪
  category: 'yoga' | 'spinning' | 'pesas' | 'funcional' | 'crossfit';
}