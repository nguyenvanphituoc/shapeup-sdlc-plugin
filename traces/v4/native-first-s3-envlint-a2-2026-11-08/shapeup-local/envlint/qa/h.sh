W=$(mktemp -d)
cd "$W"
E=/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer/bin/envlint.mjs
r(){ node $E "$@"; echo "rc=$?"; }
echo '{"A":{"type":"int"}}' > s.json
printf 'A=1\n' > ok.env
echo '## help'; r --help
echo '## ctor key required'; echo '{"constructor":{"required":true}}' > s2.json; r --schema s2.json ok.env
echo '## proto env keys'; printf 'constructor=x\n__proto__=y\n' > p.env; echo '{"__proto__":{"required":true},"toString":{"type":"int"}}' > s3.json; r --schema s3.json p.env
echo '## type toString'; echo '{"A":{"type":"toString"}}' > s4.json; r --schema s4.json ok.env
echo '## BOM'; printf '\xef\xbb\xbfA=x\n' > bom.env; r --schema s.json bom.env
echo '## CR only'; printf 'A=1\rB=2\r' > cr.env; r --schema s.json cr.env
echo '## dir'; r --schema s.json .
echo '## null schema'; echo null > n.json; r --schema n.json ok.env
echo '## quotes'; printf 'A="x"y"\nB="\nC=1 # c\nD=" 5 "\n' > q.env; echo '{"A":{"type":"string"},"C":{"type":"int"},"D":{"type":"int"}}' > sq.json; r --schema sq.json q.env
echo '## huge int'; printf 'A=99999999999999999999999\n' > h.env; r --schema s.json h.env
echo '## unicode digits'; printf 'A=١٢٣\n' > u.env; r --schema s.json u.env
echo '## urls'; echo '{"U":{"type":"url"}}' > su.json
for u in 'http://' 'http:///x' 'file:///etc/passwd' 'a://b' 'http://exa mple.com' 'x://:80' 'http://[::1]' '://x' 'mailto://x'; do printf 'U=%s\n' "$u" > u2.env; echo "-- $u"; r --schema su.json u2.env; done
echo '## CR mid-line'; printf 'A=1\r2\n' > crm.env; r --schema s.json crm.env
echo '## -- positional'; r --schema s.json -- -x.env
echo '## schema=s'; r --schema=s.json ok.env
echo '## extra'; r --schema s.json ok.env extra
echo '## ANSI in value'; printf 'A=\033[31mred\n' > ansi.env; r --schema s.json ansi.env | cat -v
echo '## export edge'; printf 'export\nexport  A=1\nexportA=1\n' > ex.env; echo '{"A":{"required":true}}' > sr.json; r --schema sr.json ex.env
echo '## empty required'; printf 'A=\n' > em.env; echo '{"A":{"required":true,"type":"int"}}' > se.json; r --schema se.json em.env
echo '## dup last wins'; printf 'M=bad\nM=dev\n' > d.env; echo '{"M":{"enum":["dev"]}}' > sd.json; r --schema sd.json d.env
echo '## rule null'; echo '{"A":null}' > sn.json; r --schema sn.json ok.env
echo '## __proto__ json schema key'; echo '{"__proto__":{"type":"int"}}' > sx.json; printf '__proto__=abc\n' > px.env; r --schema sx.json px.env
echo '## empty file'; : > empty.env; r --schema s.json empty.env
echo '## stdout closed'; printf 'A=x\nB\n' > bad.env; node $E --schema s.json bad.env >&- ; echo "rc=$?"
echo '## key with space'; printf 'A B=1\nA =5\n' > sp.env; r --schema s.json sp.env
