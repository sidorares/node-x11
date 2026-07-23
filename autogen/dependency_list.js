const index = require('./makeindex');
index('./proto/', index => {
   for (i in index) {
      console.log(index[i].header);
      index[i].depends.forEach(d => {
          console.log(`    ${d}`);
      });
   }
});
