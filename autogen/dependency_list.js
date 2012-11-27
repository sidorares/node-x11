var index = require('./makeindex');
index('./proto/', function(index) {
   for (i in index) {
      console.log(index[i].header);
      index[i].depends.forEach(function(d) {
          console.log('    ' + d);
      });
   }
});
