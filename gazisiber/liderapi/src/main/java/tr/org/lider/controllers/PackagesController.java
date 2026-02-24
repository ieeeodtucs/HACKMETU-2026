package tr.org.lider.controllers;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.OperationType;
import tr.org.lider.models.ConfigParams;
import tr.org.lider.models.PackageInfo;
import tr.org.lider.plugins.RepoSourcesListParser;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.OperationLogService;


/**
 * 
 * Return package list from the specified Linux package repository
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 *
 */

@Secured({"ROLE_ADMIN", "ROLE_COMPUTERS" })
@RestController
@RequestMapping("/api/packages")
@Tag(name = "Packages", description="Packages Rest Service")
public class PackagesController {
	
	private final Logger logger = org.slf4j.LoggerFactory.getLogger(this.getClass());

	@Autowired
	ConfigurationService configurationService;
	
	@Autowired
	private OperationLogService operationLogService;

	@Operation(summary = "Gets package list", description = "", tags = { "packages-service" })
	@ApiResponses(value = {
      	  @ApiResponse(responseCode = "200", description = "Returns package list"),
		  @ApiResponse(responseCode = "417",description = "Could not package list.Unexpected error occured",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<PackageInfo>> getPackageList(@RequestParam(value="type") String type,
			@RequestParam(value="url") String url,
			@RequestParam(value="component") String component) {
		List<PackageInfo> resultSet = new ArrayList<PackageInfo>();
		List<PackageInfo> items = RepoSourcesListParser.parseURL(url.trim(), component.split(" ")[0],
				Arrays.copyOfRange(component.split(" "), 1, component.split(" ").length), "amd64",
				type);
		if (items != null && !items.isEmpty())
			resultSet.addAll(items);
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(resultSet);
				
	}

	@Operation(summary = "Update pardus repository", description = "", tags = { "packages-service" })
	@ApiResponses(value = { 
      	  @ApiResponse(responseCode = "200", description = "Updated pardus repository"),
		  @ApiResponse(responseCode ="417",description = "Could not update pardus repository. Unexpected error occured",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/update/repo-address", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<HashMap<String, Object>> updateRepoAddrSettings(@RequestParam (value = "pardusRepoAddress", required = true) String pardusRepoAddress,
			@RequestParam (value = "pardusRepoComponent", required = true) String pardusRepoComponent) {
		ConfigParams configParams = configurationService.getConfigParams();
		configParams.setPardusRepoAddress(pardusRepoAddress);
		configParams.setPardusRepoComponent(pardusRepoComponent);
		if(configurationService.updateConfigParams(configParams) != null) {
			HashMap<String, Object> repoMap = new HashMap<String, Object>();
			repoMap.put("pardusRepoAddress", configParams.getPardusRepoAddress());
			repoMap.put("pardusRepoComponent", configParams.getPardusRepoComponent());
			
			Map<String, Object> requestData = new HashMap<String, Object>();
			requestData.put("pardusRepoAddress",configParams.getPardusRepoAddress());
			requestData.put("pardusRepoComponent",configParams.getPardusRepoComponent());
			ObjectMapper dataMapper = new ObjectMapper();
			String jsonString = null ; 
			try {
				jsonString = dataMapper.writeValueAsString(requestData);
			} catch (JsonProcessingException e1) {
				logger.error("Error occured while mapping request data to json. Error: " +  e1.getMessage());
			}
			String log = pardusRepoAddress + " has been updated";
			operationLogService.saveOperationLog(OperationType.UPDATE, log, jsonString.getBytes(), null, null, null);
			
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(repoMap);
					
		} else {
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}
	
//	get directory server(Active Directory and OpenLDAP) configurations method for ldap-login task
	@Operation(summary = "Directory server configuration for ldap login task", description = "", tags = { "packages-service" })
	@ApiResponses(value = { 
      	  @ApiResponse(responseCode = "200", description = "Returns Open Ldap configurations"),
		  @ApiResponse(responseCode = "417",description = "Could not configurations to directory server. Unexpected error occured",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/repo-address", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<HashMap<String, Object>> getConfigParams() {
		HashMap<String, Object> repoMap = new HashMap<String, Object>();
		repoMap.put("pardusRepoAddress", configurationService.getPardusRepoAddress());
		repoMap.put("pardusRepoComponent", configurationService.getPardusRepoComponent());
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(repoMap);
				
	}
}
