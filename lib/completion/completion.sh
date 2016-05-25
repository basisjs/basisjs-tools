###-begin-basis-completion-###
#
# basis command completion script
#
# Original file https://github.com/isaacs/npm/blob/master/lib/utils/completion.sh
#
# Installation: basis completion >> ~/.bashrc  (or ~/.zshrc)
# Or, maybe: basis completion > /usr/local/etc/bash_completion.d/basis
#

COMP_WORDBREAKS=${COMP_WORDBREAKS/=/}
COMP_WORDBREAKS=${COMP_WORDBREAKS/@/}
export COMP_WORDBREAKS

if type complete &>/dev/null; then
  _basis_completion () {
    local si="$IFS"
    IFS=$'\n' COMPREPLY=($(COMP_CWORD="$COMP_CWORD" \
                           COMP_LINE="$COMP_LINE" \
                           COMP_POINT="$COMP_POINT" \
                           basis completion -- "${COMP_WORDS[@]}" \
                           2>/dev/null)) || return $?
    IFS="$si"
  }
  complete -F _basis_completion basis
elif type compdef &>/dev/null; then
  _basis_completion() {
    si=$IFS
    compadd -- $(COMP_CWORD=$((CURRENT-1)) \
                 COMP_LINE=$BUFFER \
                 COMP_POINT=0 \
                 basis completion -- "${words[@]}" \
                 2>/dev/null)
    IFS=$si
  }
  compdef _basis_completion basis
elif type compctl &>/dev/null; then
  _basis_completion () {
    local cword line point words si
    read -Ac words
    read -cn cword
    let cword-=1
    read -l line
    read -ln point
    si="$IFS"
    IFS=$'\n' reply=($(COMP_CWORD="$cword" \
                       COMP_LINE="$line" \
                       COMP_POINT="$point" \
                       basis completion -- "${words[@]}" \
                       2>/dev/null)) || return $?
    IFS="$si"
  }
  compctl -K _basis_completion basis
fi
###-end-basis-completion-###