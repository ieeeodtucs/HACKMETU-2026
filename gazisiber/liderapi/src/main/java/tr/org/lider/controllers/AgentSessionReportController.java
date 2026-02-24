package tr.org.lider.controllers;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;

import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.dto.AgentDTO;
import tr.org.lider.dto.AgentSessionDTO;
import tr.org.lider.entities.AgentImpl;
import tr.org.lider.services.AgentSessionReportService;
import tr.org.lider.services.ExcelExportService;
import tr.org.lider.services.UserSessionReportService;
import tr.org.lider.utils.IUserSessionReport;

@Secured({"ROLE_ADMIN", "ROLE_USER_SESSION_REPORT" })
@RestController
@RequestMapping("/api/lider/agent-session")
@Tag(name = "Agent session service", description = "Agent Sesion Report controller")
public class AgentSessionReportController {
	
	private final Logger logger = org.slf4j.LoggerFactory.getLogger(this.getClass());

	@Autowired
	private AgentSessionReportService agentSessionReportService;
	
	@Autowired
	private UserSessionReportService userSessionReportService;
	
	@Autowired
	private ExcelExportService excelService;
	
	@Operation(summary = "Find all agents", description = "", tags = { "agent-service" })
	@ApiResponses(value = { 
			@ApiResponse(responseCode = "200", description = "Find all agents", 
				content = { @Content(schema = @Schema(implementation = AgentImpl.class)) 
				}), 
			@ApiResponse(responseCode = "417", description = "Could not retrieve agents list. Unexpected error occured.", 
			content = { @Content(schema = @Schema(implementation = String.class)) 
			}) 
		})
	@PostMapping(value = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<HashMap<String, Object>> findAllAgents( AgentDTO agentDTO) {
		HashMap<String, Object> resultMap = new HashMap<>();
		if(agentDTO.getGetFilterData().isPresent() && agentDTO.getGetFilterData().get()) {
			resultMap.put("brands", agentSessionReportService.getBrands());
			resultMap.put("models", agentSessionReportService.getmodels());
			resultMap.put("processors", agentSessionReportService.getProcessors());
			resultMap.put("osVersions", agentSessionReportService.getOSVersions());
			resultMap.put("agentVersions", agentSessionReportService.getAgentVersions());
			resultMap.put("diskType", agentSessionReportService.getDiskType());
		}
		Page<AgentImpl> listOfAgents = agentSessionReportService.findAllAgents(agentDTO);
				
		resultMap.put("agents", listOfAgents);
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(resultMap);
	}

	@Operation(summary = "Find agent session detail by id.", description = "", tags = { "agent-service" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Find agent detail by id.", 
			    content = { @Content(schema = @Schema(implementation = AgentImpl.class)) }),
			  @ApiResponse(responseCode = "404", description = "Agent id not found.Not found.", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/detail", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?>  getAgentSessionsDetail(AgentSessionDTO agentSessionDTO) {
		logger.debug("Agent id:  {} ", agentSessionDTO.getAgentID());
		Page<IUserSessionReport> agentSessionList = agentSessionReportService.getSessionList(agentSessionDTO);
		
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(agentSessionList);
	}

	@Operation(summary = "Exports filtered agent session list to excel", description = "", tags = { "agent-service" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Created excel file successfully", 
			    content = { @Content(schema = @Schema(implementation = AgentImpl.class)) }),
			  @ApiResponse(responseCode = "400", description = "Could not create client report.", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/export", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> export(AgentSessionDTO agentSessionDTO){
		agentSessionDTO.setPageNumber(1);
		agentSessionDTO.setPageSize(userSessionReportService.count().intValue());
		Page<IUserSessionReport> agentSessionList = agentSessionReportService.getSessionList(agentSessionDTO);
		try {
			if (agentSessionList != null) {
				HttpHeaders headers = new HttpHeaders();
				headers.add("fileName", "Oturum Raporu_" + new SimpleDateFormat("dd_MM_yyyy_HH:mm:ss.SSS").format(new Date()) + ".xlsx");
				headers.setContentType(MediaType.parseMediaType("application/csv"));
				headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
				byte[] excelContent = excelService.generateUserSessionReport(agentSessionList.getContent());
				return new ResponseEntity<byte[]>(excelContent, headers,  HttpStatus.OK);
			}
			else {
				HttpHeaders headers = new HttpHeaders();
	            headers.add("message", "Invalid session type: " + agentSessionDTO.getSessionType());
	            return ResponseEntity
	                .status(HttpStatus.BAD_REQUEST)
	                .headers(headers)
	                .build();
			}
		} catch (Exception e) {
        	logger.error("Error occured while creating excel report Error: ." + e.getMessage());
        	HttpHeaders headers = new HttpHeaders();
        	headers.add("message", "Error occured while creating excel report. Error: " + e.getMessage());
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}
}
