#!/bin/sh

if [ $1 -gt 0 ]; then
  count=$1
else
  count=1
fi

printf "\nRunning test for $count times...\n\n"

for i in `seq 1 $count`; do
  printf "\nTest #$i:\n\n"
  npm test
done
