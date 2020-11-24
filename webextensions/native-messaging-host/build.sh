#!/usr/bin/env bash

#set -x

dist_dir="$(cd "$(dirname "$0")" && pwd)"
temp_src="src/temp_flexible_confirm_mail"

if go version 2>&1 >/dev/null
then
  echo "using $(go version)"
else
  echo 'ERROR: golang is missing.' 1>&2
  exit 1
fi

if [ "$GOPATH" = '' ]
then
  echo 'ERROR: You must set GOPATH environment variable before you run this script.' 1>&2
  exit 1
fi

if [ -d "$temp_src" ]
then
  echo "ERROR: You must remove previous '$temp_src' before building." 1>&2
  exit 1
fi

main() {
  cd "$GOPATH"

  echo "preparing dependencies..."
  prepare_dependency github.com/harry1453/go-common-file-dialog
    prepare_dependency github.com/go-ole/go-ole
    prepare_dependency github.com/google/uuid
  prepare_dependency github.com/mitchellh/gox
  prepare_dependency github.com/lhside/chrome-go
  mkdir -p "$temp_src"
  ln -s "$dist_dir" "$temp_src/host"

  local path="$(echo "$temp_src" | sed 's;^src/;;')/host"
  gox -os="windows" "$path"

  local arch
  for binary in *.exe
  do
    arch="$(basename "$binary" '.exe' | sed 's/.\+_windows_//')"
    mkdir -p "$dist_dir/$arch"
    mv "$binary" "$dist_dir/$arch/host.exe"
  done

  rm "$temp_src/host"
  rm -rf "$temp_src"

  echo "done."
}

prepare_dependency() {
  local path="$1"
  [ -d "src/$path" ] || go get "$path"
}

main
