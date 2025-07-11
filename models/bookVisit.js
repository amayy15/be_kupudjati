import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const BookVisitSchema = new Schema({
  barcode: { type: String, required: true, unique: true },
  visitCount: { type: Number, default: 1 },
  lastVisitedAt: { type: Date, default: Date.now }
});

const BookVisit = mongoose.model('BookVisit', BookVisitSchema);

export default BookVisit;