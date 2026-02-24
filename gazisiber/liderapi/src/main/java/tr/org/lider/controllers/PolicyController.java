package tr.org.lider.controllers;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.CommandImpl;
import tr.org.lider.entities.PolicyImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.models.PolicyExecutionRequestImpl;
import tr.org.lider.models.PolicyResponse;
import tr.org.lider.services.PolicyExceptionService;
import tr.org.lider.services.PolicyService;

/**
 * 
 * Return the policies, saved, edited and deleted policy
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 *
 */
@Secured({"ROLE_ADMIN", "ROLE_COMPUTERS" })
@RestController
@RequestMapping("/api/policy")
@Tag(name = "Policy" , description = "Policy Rest Service")
public class PolicyController {

	Logger logger = LoggerFactory.getLogger(PolicyController.class);

	@Autowired
	private PolicyService policyService;
	
	@Autowired
	private PolicyExceptionService policyExceptionService;

	//	return policies if deleted is false
	
	//@RequestMapping(method=RequestMethod.POST ,value = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
	
	@Operation(summary = "Get policy list", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Returns policy list. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not get policy list. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<PolicyImpl>> policyList() {
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(policyService.list());
					
		} catch (DataAccessException e) {
			logger.error("Error list policy: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}

	//	return saved policy
	//@RequestMapping(method=RequestMethod.POST ,value = "/add", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Add policy to policy service", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Added policy to policy service.Successful"),
			  @ApiResponse(responseCode = "417", description = "Coul not add policy to policy service. Unexpected error occurred.", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/add", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<PolicyImpl> policyAdd(@RequestBody PolicyImpl params) {
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(policyService.add(params));
					
		} catch (DataAccessException e) {
			logger.error("Error saving policy: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}

	//	return deleted policy. Never truly delete, just mark as deleted!
	@Operation(summary = "Delete policy from policy service", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Deleted policy. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not delete policy. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@DeleteMapping(value = "/delete/id/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<PolicyImpl> policyDelete(@PathVariable Long id) {
		try {
			
			policyExceptionService.deletePolicyExceptionByPolicy(policyService.findPolicyByID(id));
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(policyService.delete(id));
					
		} catch (DataAccessException e) {
			logger.error("Error delete policy: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}

	//	return active policy
	@Operation(summary = "Activate the policy", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Policy activated. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not activate policy. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/active", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<PolicyImpl> policyEnabled(@RequestBody PolicyImpl params) {
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(policyService.active(params));
					
		} catch (DataAccessException e) {
			e.printStackTrace();
			logger.error("Error active or passive policy: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}

	//	return passive policy
	@Operation(summary = "Returns passive policies", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Gets passive policy. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not get passive policy. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/passive", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<PolicyImpl> policyDisabled(@RequestBody PolicyImpl params) {
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(policyService.passive(params));
					
		} catch (DataAccessException e) {
			e.printStackTrace();
			logger.error("Error passive policy: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}

	//	return updated policy
	@Operation(summary = "Update policy", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Updated policy. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not update policy. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/update", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<PolicyImpl> policyUpdated(@RequestBody PolicyImpl params) {
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(policyService.update(params));
			
		} catch (DataAccessException e) {
			e.printStackTrace();
			logger.error("Error updated policy: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}
	// executed policy
	@Operation(summary = "Execute policy", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Executed policy. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not execute policy. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/execute", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> policyExecute(@RequestBody PolicyExecutionRequestImpl request) {
		try {
			policyService.executePolicy(request);
			//return new RestResponseImpl(RestResponseStatus.OK, new ArrayList<>(), null);
			return ResponseEntity
				.status(HttpStatus.OK)
				.body("Task is executed.");
			
		} catch (Exception e) {
			return ResponseEntity
				.status(HttpStatus.EXPECTATION_FAILED)
				.body("Task isn't executed.");

		}
		
			
	}
	
	@Operation(summary = "List group policies", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Returns group policies.Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not get policy group. Unexpected error occured ", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/policies-for-group/dn/{dn}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<PolicyResponse>> getPolicies4Group(@PathVariable String dn) {
		logger.info("Getting executed policies for group. DN : " +dn);
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(policyService.getPoliciesForGroup(dn));
	}
	
	@Operation(summary = "Unassignment on a policy", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Policy has been unassigned.Succesful"),
			  @ApiResponse(responseCode = "417", description = "Could not  assignment on policy. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/unassignment", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<CommandImpl> unassignmentPolicyOfUser(@RequestBody CommandImpl id) {
		logger.info("Getting executed policies for group. DN : " +id);
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(policyService.unassignmentCommandForUserPolicy(id));
	}
	
	@Operation(summary = "Returns active policies", description = "", tags = { "policy" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Gets active policy. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not get active policy. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/active-policies", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<PolicyImpl>> activePolicyList() {
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(policyService.activePolicies());
			
		} catch (DataAccessException e) {
			logger.error("Error get active policy list: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}
}
