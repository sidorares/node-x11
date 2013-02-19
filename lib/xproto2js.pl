# convert X protocol docline
#     #x00000020     name
# to JS line 
#     name: x00000020
while(<>) {
    my($line) = $_;
    chomp($line);
    if ($line =~ /(x[0-9]+)[ \t]+([^ ]+)/)
    {
       print "$2: 0$1,\n"; 
    }
}