package tr.org.lider.dto;

import java.util.Date;
import java.util.Optional;

import org.springframework.format.annotation.DateTimeFormat;

public class AgentDTO {
	
	private int pageNumber;
    private int pageSize;
    private Optional<String> sessionReportType;
    private Optional<Boolean> getFilterData;
    @DateTimeFormat(pattern = "dd/MM/yyyy HH:mm:ss")
    private Optional<Date> registrationStartDate;
    @DateTimeFormat(pattern = "dd/MM/yyyy HH:mm:ss")
    private Optional<Date> registrationEndDate;
    private Optional<String> status;
    private Optional<String> dn;
    private Optional<String> hostname;
    private Optional<String> macAddress;
    private Optional<String> ipAddress;
    private Optional<String> brand;
    private Optional<String> model;
    private Optional<String> processor;
    private Optional<String> osVersion;
    private Optional<String> agentVersion;
    private Optional<String> diskType;
    private Optional<String> agentStatus;
    private Optional<String> selectedOUDN;
    private Optional<String> groupName;
    private Optional<String> groupDN;
    
    public int getPageNumber() {
		return pageNumber;
	}
	public void setPageNumber(int pageNumber) {
		this.pageNumber = pageNumber;
	}
	public int getPageSize() {
		return pageSize;
	}
	public void setPageSize(int pageSize) {
		this.pageSize = pageSize;
	}
	public Optional<String> getSessionReportType() {
		return sessionReportType;
	}
	public void setSessionReportType(Optional<String> sessionReportType) {
		this.sessionReportType = sessionReportType;
	}
	public Optional<Boolean> getGetFilterData() {
		return getFilterData;
	}
	public void setGetFilterData(Optional<Boolean> getFilterData) {
		this.getFilterData = getFilterData;
	}
	public Optional<Date> getRegistrationStartDate() {
		return registrationStartDate;
	}
	public void setRegistrationStartDate(Optional<Date> registrationStartDate) {
		this.registrationStartDate = registrationStartDate;
	}
	public Optional<Date> getRegistrationEndDate() {
		return registrationEndDate;
	}
	public void setRegistrationEndDate(Optional<Date> registrationEndDate) {
		this.registrationEndDate = registrationEndDate;
	}
	public Optional<String> getStatus() {
		return status;
	}
	public void setStatus(Optional<String> status) {
		this.status = status;
	}
	public Optional<String> getDn() {
		return dn;
	}
	public void setDn(Optional<String> dn) {
		this.dn = dn;
	}
	public Optional<String> getHostname() {
		return hostname;
	}
	public void setHostname(Optional<String> hostname) {
		this.hostname = hostname;
	}
	public Optional<String> getMacAddress() {
		return macAddress;
	}
	public void setMacAddress(Optional<String> macAddress) {
		this.macAddress = macAddress;
	}
	public Optional<String> getIpAddress() {
		return ipAddress;
	}
	public void setIpAddress(Optional<String> ipAddress) {
		this.ipAddress = ipAddress;
	}
	public Optional<String> getBrand() {
		return brand;
	}
	public void setBrand(Optional<String> brand) {
		this.brand = brand;
	}
	public Optional<String> getModel() {
		return model;
	}
	public void setModel(Optional<String> model) {
		this.model = model;
	}
	public Optional<String> getProcessor() {
		return processor;
	}
	public void setProcessor(Optional<String> processor) {
		this.processor = processor;
	}
	public Optional<String> getOsVersion() {
		return osVersion;
	}
	public void setOsVersion(Optional<String> osVersion) {
		this.osVersion = osVersion;
	}
	public Optional<String> getAgentVersion() {
		return agentVersion;
	}
	public void setAgentVersion(Optional<String> agentVersion) {
		this.agentVersion = agentVersion;
	}
	public Optional<String> getDiskType() {
		return diskType;
	}
	public void setDiskType(Optional<String> diskType) {
		this.diskType = diskType;
	}
	public Optional<String> getAgentStatus() {
		return agentStatus;
	}
	public void setAgentStatus(Optional<String> agentStatus) {
		this.agentStatus = agentStatus;
	}
	public Optional<String> getGroupDN() {
		return groupDN;
	}
	public void setGroupDN(Optional<String> groupDN) {
		this.groupDN = groupDN;
	}
	public Optional<String> getGroupName() {
		return groupName;
	}
	public void setGroupName(Optional<String> groupName) {
		this.groupName = groupName;
	}
	public Optional<String> getSelectedOUDN() {
		return selectedOUDN;
	}
	public void setSelectedOUDN(Optional<String> selectedOUDN) {
		this.selectedOUDN = selectedOUDN;
	}
}
