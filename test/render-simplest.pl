#!/usr/bin/perl

use X11::Protocol;
use strict;
use IO::Select;
my $X = new X11::Protocol;
$X->init_extension("RENDER") or die;

my($rgb24, $rgba32);

$rgb24 = 71;
$rgba32 = 69;

my $win = $X->new_rsrc;
$X->CreateWindow($win, $X->root, 'InputOutput', $X->root_depth,
                 'CopyFromParent', (0, 0), 500, 500, 4,
                 'event_mask' => $X->pack_event_mask('Exposure'));

$X->MapWindow($win);
my $picture = $X->new_rsrc;
$X->RenderCreatePicture($picture, $win, $rgb24, 'poly_edge' => 'Smooth', 'poly_mode' => 'Precise');

my $pixmap = $X->new_rsrc;
$X->CreatePixmap($pixmap, $win, 32, 1000, 1000);
my $pix_pict = $X->new_rsrc;
$X->RenderCreatePicture($pix_pict, $pixmap, $rgba32, 'poly_edge' => 'Smooth', 'poly_mode' => 'Precise');
$X->RenderFillRectangles('Src', $pix_pict, [0xffff, 0, 0, 0x8000], [0, 0, 1000, 1000]);

$X->event_handler('queue');
#my $fds = IO::Select->new($X->connection->fh);

sub draw {
    $X->RenderFillRectangles('Src', $picture, [(0xffff)x4], [0, 0, 500, 500]);
    
    $X->RenderSetPictureFilter($pix_pict, "nearest");
    $X->RenderTriangles('Over', $pix_pict, 500, 500, $picture, 0, [(250, 100), (100, 350), (400, 350), (175, 100), (185, 100), (180, 0)]);
    #$X->RenderFillRectangles('Src', $picture, [(0xffff, 0, 0, 0xffff)], [10, 10, 50, 50]);
}

for (;;) {
    my %e;
    $X->handle_input;
    if (%e = $X->dequeue_event) {
	if ($e{'name'} eq "Expose") {
	    draw();
	}
    }
}
