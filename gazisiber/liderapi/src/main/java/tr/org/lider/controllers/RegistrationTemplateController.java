package tr.org.lider.controllers;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
import tr.org.lider.entities.RegistrationTemplateImpl;
import tr.org.lider.models.RegistrationTemplateType;
import tr.org.lider.services.RegistrationTemplateService;
import tr.org.lider.services.OperationLogService;

/**
 * REST controller for managing registration template
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */
@Secured({"ROLE_ADMIN", "ROLE_REGISTRATION_TEMPLATE" })
@RestController
@RequestMapping("/api")
@Tag(name = "Registration Template", description = "Registration Template Rest Service")
public class RegistrationTemplateController {
	
	private final Logger logger = org.slf4j.LoggerFactory.getLogger(this.getClass());
	
	@Autowired
	private RegistrationTemplateService registrationTemplateService;
	
	@Autowired
	private OperationLogService operationLogService;	
	
	@Operation(summary = "Find registration template by id", description = "", tags = { "registration-template" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Template id exists", 
			    content = { @Content(schema = @Schema(implementation = RegistrationTemplateImpl.class)) }),
			  @ApiResponse(responseCode = "404", description = "Template id not found", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/registration-templates/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<RegistrationTemplateImpl> findByID(@PathVariable Long id) {
		logger.debug("Request to get template by id : {}", id);
		Optional<RegistrationTemplateImpl> result = registrationTemplateService.findByID(id);
		if(!result.isPresent()) {
			logger.error("Request to get template by id : {} but id not found!", id);
        	HttpHeaders headers = new HttpHeaders();
        	headers.add("message", "Template id not found");
    		return ResponseEntity
    				.status(HttpStatus.NOT_FOUND)
    				.headers(headers)
    				.build();
		}
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(result.get());
	}
	
	@Operation(summary = "Find registration templates by template type", description = "", tags = { "registration-template" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "") })
	@GetMapping(value = "/registration-templates/type/{templateType}/page-count/{pageCount}/page-size/{pageSize}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Page<RegistrationTemplateImpl>> findAll(@PathVariable RegistrationTemplateType templateType,
			@PathVariable int pageCount, @PathVariable int pageSize) {
		logger.debug("Request to get all templates for type : {}", templateType);
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(registrationTemplateService.findAllByType(pageCount, pageSize, templateType));
	}

	@Operation(summary = "Create registration template", description = "", tags = { "registration-template" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "", 
			    content = { @Content(schema = @Schema(implementation = RegistrationTemplateImpl.class)) }),
			  @ApiResponse(responseCode = "400", description = "A new template can not have an ID !", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/registration-templates", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<RegistrationTemplateImpl> createTemplate(@RequestBody RegistrationTemplateImpl template) {
		logger.debug("Request to save template : {}", template);
        if (template.getId() != null) {
        	logger.error("Request to save template : {} but template id has to be null.", template);
        	HttpHeaders headers = new HttpHeaders();
        	headers.add("message", "A new template can not have an ID !");
    		return ResponseEntity
    				.status(HttpStatus.BAD_REQUEST)
    				.headers(headers)
    				.build();
        }
        RegistrationTemplateImpl result = registrationTemplateService.save(template);
        
        Map<String, Object> requestData = new HashMap<String, Object>();
		requestData.put("createdTemplate",result);
		ObjectMapper dataMapper = new ObjectMapper();
		String jsonString = null ; 
		try {
			jsonString = dataMapper.writeValueAsString(requestData);
		} catch (JsonProcessingException e1) {
			logger.error("Error occured while mapping request data to json. Error: " +  e1.getMessage());
		}
		String log = result.getUnitId() + " registiration template has been created";
		operationLogService.saveOperationLog(OperationType.CREATE, log, jsonString.getBytes(), null, null, null);
        
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(result);
	}
	
	@Operation(summary = "Update registration template", description = "", tags = { "registration-template" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "", 
			    content = { @Content(schema = @Schema(implementation = RegistrationTemplateImpl.class)) }),
			  @ApiResponse(responseCode = "400", description = "Template id not found !", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PutMapping(value = "/registration-templates", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<RegistrationTemplateImpl> updateTemplate(@RequestBody RegistrationTemplateImpl template) {
		logger.debug("Request to update template : {}", template);
		Optional<RegistrationTemplateImpl> existingTemplate = registrationTemplateService.findByID(template.getId());
		if(!existingTemplate.isPresent()) {
			logger.error("Request to update template {} but template not found!", template);
        	HttpHeaders headers = new HttpHeaders();
        	headers.add("message", "Template id not found !");
    		return ResponseEntity
    				.status(HttpStatus.NOT_FOUND)
    				.headers(headers)
    				.build();
		}
		//update allowed fields
		existingTemplate.get().setAuthGroup(template.getAuthGroup());
		existingTemplate.get().setUnitId(template.getUnitId());
		existingTemplate.get().setParentDn(template.getParentDn());
		RegistrationTemplateImpl result = registrationTemplateService.save(existingTemplate.get());
		
		Map<String, Object> requestData = new HashMap<String, Object>();
		requestData.put("existingTemplate",existingTemplate.get());
		ObjectMapper dataMapper = new ObjectMapper();
		String jsonString = null ; 
		try {
			jsonString = dataMapper.writeValueAsString(requestData);
		} catch (JsonProcessingException e1) {
			logger.error("Error occured while mapping request data to json. Error: " +  e1.getMessage());
		}
		String log = existingTemplate.get().getUnitId() + " registiration template has been updated";
		operationLogService.saveOperationLog(OperationType.UPDATE, log, jsonString.getBytes(), null, null, null);
		
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(result);
	}
	
	
	@Operation(summary = "Delete template by id", description = "", tags = { "registration-template" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = ""),
			  @ApiResponse(responseCode = "404", description = "Template id not found", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@DeleteMapping(value = "/registration-templates/id/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> deleteTemplate(@PathVariable Long id) {
		logger.debug("Request to delete template {} ", id);
		if(!registrationTemplateService.findByID(id).isPresent()) {
			logger.error("Request to delete template {} but id not found!", id);
        	HttpHeaders headers = new HttpHeaders();
        	headers.add("message", "Template id not found !");
    		return ResponseEntity
    				.status(HttpStatus.NOT_FOUND)
    				.headers(headers)
    				.build();
		}		
		Optional<RegistrationTemplateImpl> deletedTemplate = registrationTemplateService.findRegistrationTemplateByID(id);
		registrationTemplateService.delete(id);
		
		Map<String, Object> requestData = new HashMap<String, Object>();
		requestData.put("deletedTemplate",deletedTemplate.get());
		ObjectMapper dataMapper = new ObjectMapper();
		String jsonString = null ; 
		try {
			jsonString = dataMapper.writeValueAsString(requestData);
		} catch (JsonProcessingException e1) {
			logger.error("Error occured while mapping request data to json. Error: " +  e1.getMessage());
		}
		String log = deletedTemplate.get().getUnitId() + " registiration template has been deleted";
		operationLogService.saveOperationLog(OperationType.DELETE, log, jsonString.getBytes(), null, null, null);
		
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(null);
	}
	
}