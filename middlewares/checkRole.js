const roleCheck = (roles) => {
  return (req, res, next) => {
    const allowedRoles = Array.isArray(roles) ? [...roles] : [roles];
    allowedRoles.push("superAdmin");

    // console.log("Allowed Roles:", allowedRoles); // Debugging
    // console.log("User Roles:", req.user.roles); // Debugging

    if (
      req.user &&
      req.user.roles &&
      allowedRoles.some((role) => req.user.roles.includes(role))
    ) {
      next();
    } else {
      res.status(403).json({ error: true, message: "Unauthorized" });
    }
  };
};

export default roleCheck;
