import Joi from "joi";
import passwordComplexity from "joi-password-complexity";

const signUpValidation = (body) => {
  const schema = Joi.object({
    username: Joi.string().required().label("Username"),
    email: Joi.string().email().required().label("Email"),
    password: passwordComplexity().required().label("Password"),
  });

  return schema.validate(body);
};

const addUserValidation = (body) => {
  const schema = Joi.object({
    username: Joi.string().required().label("Username"),
    email: Joi.string().email().required().label("Email"),
    password: passwordComplexity().required().label("Password"),
    roles: Joi.array()
      .items(Joi.string().valid("user", "admin", "superAdmin"))
      .required()
      .label("Roles"),
  });

  return schema.validate(body);
};

const logInValidation = (body) => {
  const schema = Joi.object({
    email: Joi.string().email().required().label("Email"),
    password: Joi.string().required().label("Password"),
  });

  return schema.validate(body);
};

const refreshTokenValidation = (body) => {
  const schema = Joi.object({
    refreshToken: Joi.string().required().label("Refresh Token"),
  });

  return schema.validate(body);
};

const booksValidation = (body) => {
  const schema = Joi.object({
    isbn: Joi.string().required().label("ISBN"),
    title: Joi.string().required().label("Title"),
    author: Joi.string().required().label("Author"),
    publicationYear: Joi.number().required().label("Publication Year"),
    publisher: Joi.string().required().label("Publisher"),
  });

  return schema.validate(body);
};

const cityValidation = (body) => {
  const schema = Joi.object({
    city_name: Joi.string().required().label("City Name"),
    city_id: Joi.string().required().label("City ID"),
    type: Joi.string().valid("Kota", "Kabupaten").required().label("Type"),
  });

  return schema.validate(body);
};

const locationValidation = (body) => {
  const schema = Joi.object({
    city_id: Joi.string().required().label("City ID"),
    location_name: Joi.string().required().label("Location Name"),
    address: Joi.string().required().label("Address"),
  });

  return schema.validate(body);
};

const editUserValidation = (body, role) => {
  const schema = Joi.object({
    username: Joi.string().required().label("Username"),
    email: Joi.string().email().required().label("Email"),
  });

  return schema.validate(body, {
    context: { isSuperAdmin: role.includes("superAdmin") },
  });
};

const bookListValidation = (body) => {
  const schema = Joi.object({
    location_id: Joi.string().required().label("Location ID"),
    book_id: Joi.array().items(Joi.string().required()).min(1).label("Book ID"),
  });

  return schema.validate(body);
};

const subCategoryValidation = (body) => {
  const schema = Joi.object({
    ctgyId: Joi.number().required().label("ID Kategori"),
    subCtgyName: Joi.string().required().label("Nama Sub Kategori"),
    subCtgyIds: Joi.array()
      .items(Joi.number().required())
      .min(1)
      .label("ID Kategori"),
    subCtgyIcon: Joi.string().required().label("Nama Ikon"),
    subCtgyIconLib: Joi.string().required().label("Icon Library"),
    // subCtgyType: Joi.array()
    //   .items(Joi.string().valid("tunggal", "plural"))
    //   .required()
    //   .label("Tipe Sub Kategori"),
    subCtgyPath: Joi.string().required().label("Path"),
  });

  return schema.validate(body);
};

export {
  signUpValidation,
  addUserValidation,
  logInValidation,
  refreshTokenValidation,
  booksValidation,
  cityValidation,
  locationValidation,
  bookListValidation,
  editUserValidation,
  subCategoryValidation,
};
