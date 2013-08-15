# this should do the same thing as minify_json.py, just faster. 
cat $1 | sed -e 's/\.[0-9]\+ *//g' | sed -e 's/\s\+"/"/g' |  sed -e 's/ *\([:{},"\[]\+\) \+/\1/g' | tr -d '\n' | sed -e 's/] /]/g'   > $2

