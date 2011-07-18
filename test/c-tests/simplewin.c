#include <X11/Xlib.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
 
int main(void) {
   Display *d;
   Window w, w1;
   XEvent e;
   char *msg = "Hello, world!";
   int s;
 
   d = XOpenDisplay(NULL);
   if (d == NULL) {
      fprintf(stderr, "Cannot open display\n");
      exit(1);
   }
 
   s = DefaultScreen(d);
   w = XCreateSimpleWindow(d, RootWindow(d, s), 10, 10, 100, 100, 1,
                           BlackPixel(d, s), WhitePixel(d, s));
   
   w1 = XCreateSimpleWindow(d, RootWindow(d, s), 50, 50, 50, 50, 1,
                           BlackPixel(d, s), WhitePixel(d, s));
   XSelectInput(d, w, ExposureMask | KeyPressMask);
   XSelectInput(d, w1, ExposureMask);
   XMapWindow(d, w);
   XMapWindow(d, w1);
 
   while (1) {
      XNextEvent(d, &e);
      if (e.type == Expose) {
         XFillRectangle(e.xany.display, e.xany.window, DefaultGC(d, s), 20, 20, 10, 10);
         XDrawString(e.xany.display, e.xany.window, DefaultGC(d, s), 10, 50, msg, strlen(msg));
      }
      if (e.type == KeyPress)
         break;
   }
 
   XCloseDisplay(d);
   return 0;
}
