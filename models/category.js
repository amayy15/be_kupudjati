import mongoose from "mongoose";

const Schema = mongoose.Schema;

const categorySchema = new Schema({
  name: { type: String },
  categoryIds: { type: [Number] },
});

const Category = mongoose.model("Category", categorySchema);

export default Category;
