const Sequelize = require("sequelize");

const sequelize = new Sequelize("50GB_Promo_Notif","mme", "mme",{
    dialect:"mysql",
    host:"172.25.33.141",

    define: {
        freezeTableName:true
    }
});

module.exports = sequelize;

