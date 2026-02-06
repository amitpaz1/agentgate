#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

type_it() {
  local text="$1"
  local i
  for ((i=0; i<${#text}; i++)); do
    printf '%s' "${text:$i:1}"
    sleep 0.04
  done
  printf '\n'
}

clear
sleep 0.5
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
sleep 0.1
echo -e "${BLUE}  🛡️  AgentGate — Human-in-the-loop for AI agents${NC}"
sleep 0.1
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
sleep 2

echo
echo -e "${GREEN}# An AI agent needs to send a high-value invoice...${NC}"
sleep 0.5
echo -e "${DIM}# It can draft the email, but company policy says:${NC}"
sleep 0.3
echo -e "${DIM}# \"Emails over \$10k need human approval.\"${NC}"
sleep 2

echo
echo -e "${BOLD}🤖 Agent${NC} ${DIM}(via MCP tool: agentgate_request)${NC}"
sleep 0.5
type_it '   "I need to email this invoice to the client.'
type_it '    Let me request approval first."'
sleep 2

echo
echo -e "${DIM}─── Agent calls agentgate_request MCP tool ───${NC}"
sleep 0.5
echo -e "${YELLOW}  Tool: agentgate_request${NC}"
sleep 0.3
echo -e "${YELLOW}  Args: {${NC}"
sleep 0.2
echo -e "${YELLOW}    \"action\":  \"send_email\",${NC}"
sleep 0.2
echo -e "${YELLOW}    \"params\": {${NC}"
sleep 0.2
echo -e "${YELLOW}      \"to\":      \"cfo@acme.com\",${NC}"
sleep 0.2
echo -e "${YELLOW}      \"subject\": \"Invoice #4821 — \$47,500\",${NC}"
sleep 0.2
echo -e "${YELLOW}      \"body\":    \"Please find attached...\"${NC}"
sleep 0.2
echo -e "${YELLOW}    },${NC}"
sleep 0.2
echo -e "${YELLOW}    \"urgency\": \"high\"${NC}"
sleep 0.1
echo -e "${YELLOW}  }${NC}"
sleep 2

echo
echo -e "${DIM}─── AgentGate policy engine evaluates ───${NC}"
sleep 0.5
echo -e "   📋 Rule: ${CYAN}send_email + amount > \$10k${NC} → ${RED}require human approval${NC}"
sleep 0.5
echo -e "   📨 Notification → ${CYAN}Slack #approvals${NC} + ${CYAN}Dashboard${NC}"
sleep 2

echo
echo -e "${DIM}─── AgentGate response ───${NC}"
sleep 0.5
echo -e "${YELLOW}  {${NC}"
sleep 0.2
echo -e "${YELLOW}    \"requestId\": \"req_k8f2m9\",${NC}"
sleep 0.2
echo -e "${YELLOW}    \"status\":    \"pending_approval\",${NC}"
sleep 0.2
echo -e "${YELLOW}    \"policy\":    \"high-value-email\",${NC}"
sleep 0.2
echo -e "${YELLOW}    \"message\":   \"Awaiting human decision\"${NC}"
sleep 0.2
echo -e "${YELLOW}  }${NC}"
sleep 2

echo
echo -e "${GREEN}# A human reviews in Slack / Dashboard / Discord...${NC}"
sleep 1
echo
echo -e "   ${CYAN}┌──────────────────────────────────────────┐${NC}"
sleep 0.15
echo -e "   ${CYAN}│  ${BOLD}🛡️  Approval Request${NC}${CYAN}                     │${NC}"
sleep 0.15
echo -e "   ${CYAN}│                                          │${NC}"
sleep 0.15
echo -e "   ${CYAN}│  Action:  send_email                     │${NC}"
sleep 0.15
echo -e "   ${CYAN}│  To:      cfo@acme.com                   │${NC}"
sleep 0.15
echo -e "   ${CYAN}│  Subject: Invoice #4821 — \$47,500        │${NC}"
sleep 0.15
echo -e "   ${CYAN}│  Urgency: ${RED}HIGH${NC}${CYAN}                            │${NC}"
sleep 0.15
echo -e "   ${CYAN}│                                          │${NC}"
sleep 0.15
echo -e "   ${CYAN}│     ${GREEN}[ ✅ Approve ]${NC}${CYAN}  ${RED}[ ❌ Deny ]${NC}${CYAN}          │${NC}"
sleep 0.15
echo -e "   ${CYAN}└──────────────────────────────────────────┘${NC}"
sleep 2

echo
echo -e "   ${GREEN}✅ CFO clicks Approve: \"Verified, send it\"${NC}"
sleep 2

echo
echo -e "${BOLD}🤖 Agent${NC} ${DIM}(polls agentgate_status → approved!)${NC}"
sleep 0.5
type_it '   "Approved! Sending the invoice now."'
sleep 0.5
echo -e "   ✅ Email sent to cfo@acme.com"
sleep 2

echo
echo -e "${GREEN}# Full audit trail — every action tracked${NC}"
sleep 1
echo -e "${YELLOW}  \"action\":    \"send_email\"        ${DIM}→ what${NC}"
sleep 0.4
echo -e "${YELLOW}  \"requested\": \"ai-billing-agent\"  ${DIM}→ who asked${NC}"
sleep 0.4
echo -e "${YELLOW}  \"decided\":   \"sarah@company.com\" ${DIM}→ who approved${NC}"
sleep 0.4
echo -e "${YELLOW}  \"reason\":    \"Verified, send it\" ${DIM}→ why${NC}"
sleep 0.4
echo -e "${YELLOW}  \"duration\":  \"34s\"               ${DIM}→ how fast${NC}"
sleep 2

echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
sleep 0.1
echo -e "${BLUE}  Agents request. Policies decide. Humans approve.${NC}"
sleep 0.1
echo -e "${BLUE}  Full audit trail. MCP-native. Slack/Discord/Dashboard.${NC}"
sleep 0.1
echo -e "${BLUE}  → github.com/amitpaz1/agentgate${NC}"
sleep 0.1
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
sleep 8
