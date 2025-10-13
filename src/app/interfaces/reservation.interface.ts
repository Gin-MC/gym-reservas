export interface Reservation {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  classId: string;
  className: string;
  classDate: Date;
  classTime: string;
  reservationDate: Date;
  status: 'confirmed' | 'cancelled' | 'completed';
}