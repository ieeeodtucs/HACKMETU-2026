package tr.org.lider.controllers;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.AgentImpl;
import tr.org.lider.services.AgentService;

@Secured({"ROLE_ADMIN", "ROLE_COMPUTERS" })
@RestController
@RequestMapping("/api/select-agent-info")
@Tag(name = "", description = "")
public class SelectedAgentInfoController {

	@Autowired
	AgentService agentService;

	//get agent detail by agentJid
	@Operation(summary = "Get details of the selected agent", description = "", tags = { "script" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Returns details of selected agent. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not get details of selected agent. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/detail", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<AgentImpl> findAgentByJIDRest(@RequestParam (value = "agentJid") String agentJid) {
		List<AgentImpl> agent = agentService.findAgentByJid(agentJid);
		if (agent != null && agent.size() > 0) {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(agent.get(0));
					
		} else {
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}
}