import mongoose from "mongoose";

const Schema = mongoose.Schema;

const subCategorySchema = new Schema({
  ctgy_id: {
    type: Number,
    required: true,
  },
  subCtgy_name: {
    type: String,
    required: true,
  },
  subCtgy_ids: {
    type: [Number],
    required: true,
  },
  subCtgy_icon: {
    type: String,
    required: true,
  },
  subCtgy_iconLib: {
    type: String,
    required: true,
  },
  subCtgy_type: {
    type: [String],
    enum: ["tunggal", "plural"],
    required: true,
  },
  subCtgy_path: {
    type: String,
    required: true,
  },
});

const SubCategory = mongoose.model("SubCategory", subCategorySchema);

export default SubCategory;
