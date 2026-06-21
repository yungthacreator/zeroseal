#!/usr/bin/env bash
set +e

echo "ZeroSeal environment check"
echo "=========================="

for cmd in git rustc cargo rustup stellar nargo bb docker node npm just; do
  echo
  echo "[$cmd]"
  "$cmd" --version 2>&1 || echo "NOT FOUND"
done

echo
echo "[Rust targets]"
rustup target list --installed 2>&1 || echo "rustup NOT FOUND"

echo
echo "Do not install anything yet. Save this output for architecture review."
